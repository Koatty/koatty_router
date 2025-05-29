/*
 * @Description: Middleware Manager Implementation
 * @Usage: Centralized middleware management and composition
 * @Author: richen
 * @Date: 2025-01-20 10:00:00
 * @LastEditTime: 2025-01-20 10:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { KoattyContext, KoattyNext } from "koatty_core";
import { DefaultLogger as Logger } from "koatty_logger";
import compose, { Middleware } from "koa-compose";

/**
 * Middleware function type
 */
export type MiddlewareFunction = (ctx: KoattyContext, next: KoattyNext) => Promise<any> | any;

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  name: string;
  middleware: MiddlewareFunction;
  priority?: number;
  enabled?: boolean;
  conditions?: MiddlewareCondition[];
  metadata?: Record<string, any>;
}

/**
 * Middleware condition
 */
export interface MiddlewareCondition {
  type: 'path' | 'method' | 'header' | 'custom';
  value: string | RegExp | ((ctx: KoattyContext) => boolean);
  operator?: 'equals' | 'contains' | 'matches' | 'custom';
}

/**
 * Middleware execution context
 */
export interface MiddlewareExecutionContext {
  route?: string;
  method?: string;
  protocol?: string;
  metadata?: Record<string, any>;
}

/**
 * Path pattern cache for optimized matching
 */
interface PathPattern {
  exact: Set<string>;           // 精确匹配的路径
  prefixes: Map<string, boolean>; // 前缀匹配的路径
  suffixes: Map<string, boolean>; // 后缀匹配的路径
  patterns: Map<string, RegExp>;  // 复杂模式的正则表达式（仅在必要时使用）
}

/**
 * Middleware manager interface
 */
export interface IMiddlewareManager {
  register(config: MiddlewareConfig): void;
  unregister(name: string): boolean;
  compose(names: string[], context?: MiddlewareExecutionContext): MiddlewareFunction;
  getMiddleware(name: string): MiddlewareConfig | undefined;
  listMiddlewares(): MiddlewareConfig[];
}

/**
 * Middleware manager implementation
 */
export class MiddlewareManager implements IMiddlewareManager {
  private static instance: MiddlewareManager | null = null;
  private static isCreating = false;
  private readonly _instanceId: string;
  private middlewares = new Map<string, MiddlewareConfig>();
  private executionStats = new Map<string, {
    executions: number;
    totalTime: number;
    errors: number;
  }>();
  
  // 优化的路径匹配缓存
  private pathPatterns: PathPattern = {
    exact: new Set(),
    prefixes: new Map(),
    suffixes: new Map(),
    patterns: new Map()
  };
  
  // 方法匹配缓存
  private methodCache = new Map<string, Set<string>>();
  
  // 头部匹配缓存
  private headerCache = new Map<string, Map<string, string>>();

  private constructor() {
    if (MiddlewareManager.instance) {
      throw new Error('MiddlewareManager is a singleton. Use getInstance() instead.');
    }
    this._instanceId = Math.random().toString(36).substr(2, 9);
    Logger.Debug(`MiddlewareManager instance created with ID: ${this._instanceId}`);
    this.initializeBuiltinMiddlewares();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MiddlewareManager {
    if (MiddlewareManager.instance) {
      return MiddlewareManager.instance;
    }

    if (MiddlewareManager.isCreating) {
      throw new Error('MiddlewareManager is already being created');
    }

    MiddlewareManager.isCreating = true;
    try {
      MiddlewareManager.instance = new MiddlewareManager();
      Logger.Debug('MiddlewareManager singleton instance initialized');
    } finally {
      MiddlewareManager.isCreating = false;
    }

    return MiddlewareManager.instance;
  }

  /**
   * Reset singleton instance (for testing purposes only)
   */
  public static resetInstance(): void {
    MiddlewareManager.instance = null;
    MiddlewareManager.isCreating = false;
    Logger.Debug('MiddlewareManager singleton instance reset');
  }

  /**
   * Initialize built-in middlewares
   */
  private initializeBuiltinMiddlewares(): void {
    // 路由级别的参数验证中间件示例
    this.register({
      name: 'paramValidation',
      priority: 100,
      middleware: async (ctx: KoattyContext, next: KoattyNext) => {
        // 参数验证逻辑示例
        Logger.Debug('Parameter validation middleware executed');
        await next();
      },
      metadata: {
        type: 'route',
        description: 'Route-level parameter validation'
      }
    });

    // 路由级别的缓存中间件示例
    this.register({
      name: 'routeCache',
      priority: 80,
      middleware: async (ctx: KoattyContext, next: KoattyNext) => {
        // 路由缓存逻辑示例
        Logger.Debug('Route cache middleware executed');
        await next();
      },
      conditions: [
        { type: 'method', value: 'GET' }
      ],
      metadata: {
        type: 'route',
        description: 'Route-level caching for GET requests'
      }
    });

    // 路由级别的权限检查中间件示例
    this.register({
      name: 'routeAuth',
      priority: 90,
      middleware: async (ctx: KoattyContext, next: KoattyNext) => {
        // 路由权限检查逻辑示例
        Logger.Debug('Route authorization middleware executed');
        await next();
      },
      metadata: {
        type: 'route',
        description: 'Route-level authorization check'
      }
    });
  }

  /**
   * Register middleware
   */
  public register(config: MiddlewareConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Middleware name must be a non-empty string');
    }

    if (!config.middleware || typeof config.middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }

    // Set defaults
    const middlewareConfig: MiddlewareConfig = {
      priority: 500,
      enabled: true,
      conditions: [],
      metadata: {},
      ...config
    };

    if (this.middlewares.has(config.name)) {
      Logger.Warn(`Overriding existing middleware: ${config.name}`);
    }

    this.middlewares.set(config.name, middlewareConfig);
    
    // 预处理条件以优化匹配性能
    this.preprocessConditions(middlewareConfig);
    
    Logger.Debug(`Registered middleware: ${config.name}`);
  }

  /**
   * Preprocess conditions for optimized matching
   */
  private preprocessConditions(config: MiddlewareConfig): void {
    if (!config.conditions || config.conditions.length === 0) {
      return;
    }

    for (const condition of config.conditions) {
      switch (condition.type) {
        case 'path':
          this.preprocessPathCondition(condition);
          break;
        case 'method':
          this.preprocessMethodCondition(condition);
          break;
        case 'header':
          this.preprocessHeaderCondition(condition);
          break;
      }
    }
  }

  /**
   * Preprocess path conditions
   */
  private preprocessPathCondition(condition: MiddlewareCondition): void {
    if (typeof condition.value !== 'string') {
      return;
    }

    const path = condition.value;
    const operator = condition.operator || 'equals';

    switch (operator) {
      case 'equals':
        this.pathPatterns.exact.add(path);
        break;
      case 'contains':
        // 对于包含匹配，我们可以优化为前缀或后缀匹配
        if (path.startsWith('/') && !path.includes('*')) {
          this.pathPatterns.prefixes.set(path, true);
        }
        break;
      case 'matches':
        // 只有在必要时才使用正则表达式
        try {
          this.pathPatterns.patterns.set(path, new RegExp(path));
        } catch {
          Logger.Warn(`Invalid regex pattern: ${path}`);
        }
        break;
    }
  }

  /**
   * Preprocess method conditions
   */
  private preprocessMethodCondition(condition: MiddlewareCondition): void {
    if (typeof condition.value === 'string') {
      const method = condition.value.toUpperCase();
      if (!this.methodCache.has(method)) {
        this.methodCache.set(method, new Set());
      }
    }
  }

  /**
   * Preprocess header conditions
   */
  private preprocessHeaderCondition(condition: MiddlewareCondition): void {
    if (typeof condition.value === 'string') {
      const [headerName, expectedValue] = condition.value.split(':');
      if (headerName) {
        if (!this.headerCache.has(headerName.toLowerCase())) {
          this.headerCache.set(headerName.toLowerCase(), new Map());
        }
        if (expectedValue) {
          this.headerCache.get(headerName.toLowerCase())!.set(expectedValue, expectedValue);
        }
      }
    }
  }

  /**
   * Unregister middleware
   */
  public unregister(name: string): boolean {
    const result = this.middlewares.delete(name);
    
    if (result) {
      this.executionStats.delete(name);
      Logger.Debug(`Unregistered middleware: ${name}`);
    } else {
      Logger.Warn(`Middleware not found: ${name}`);
    }
    
    return result;
  }

  /**
   * Get middleware configuration
   */
  public getMiddleware(name: string): MiddlewareConfig | undefined {
    return this.middlewares.get(name);
  }

  /**
   * List all middlewares
   */
  public listMiddlewares(): MiddlewareConfig[] {
    return Array.from(this.middlewares.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Enable/disable middleware
   */
  public setEnabled(name: string, enabled: boolean): void {
    const middleware = this.middlewares.get(name);
    if (middleware) {
      middleware.enabled = enabled;
      Logger.Debug(`${enabled ? 'Enabled' : 'Disabled'} middleware: ${name}`);
    } else {
      Logger.Warn(`Middleware not found: ${name}`);
    }
  }

  /**
   * Compose middlewares
   */
  public compose(names: string[], context?: MiddlewareExecutionContext): MiddlewareFunction {
    // 获取有效的中间件配置并按优先级排序
    const validConfigs = names
      .map(name => ({ name, config: this.middlewares.get(name) }))
      .filter(({ name, config }) => {
        if (!config) {
          Logger.Warn(`Middleware not found: ${name}`);
          return false;
        }
        
        if (!config.enabled) {
          Logger.Debug(`Skipping disabled middleware: ${config.name}`);
          return false;
        }
        
        return true;
      })
      .map(({ config }) => config!)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // 创建中间件函数数组
    const middlewareFunctions = validConfigs.map(config => {
      // 如果有条件，创建条件中间件
      if (config.conditions && config.conditions.length > 0) {
        return this.createConditionalMiddleware(config, context);
      } else {
        return this.wrapMiddleware(config);
      }
    });

    return compose(middlewareFunctions);
  }

  /**
   * Create conditional middleware
   */
  private createConditionalMiddleware(
    config: MiddlewareConfig, 
    context?: MiddlewareExecutionContext
  ): Middleware<KoattyContext> {
    return async (ctx: KoattyContext, next: KoattyNext) => {
      const shouldExecute = this.evaluateConditions(config.conditions!, ctx, context);
      
      if (shouldExecute) {
        await this.wrapMiddleware(config)(ctx, next);
      } else {
        await next();
      }
    };
  }

  /**
   * Evaluate middleware conditions
   */
  private evaluateConditions(
    conditions: MiddlewareCondition[], 
    ctx: KoattyContext,
    context?: MiddlewareExecutionContext
  ): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'path':
          return this.evaluatePathCondition(condition, ctx.path);
        case 'method':
          return this.evaluateMethodCondition(condition, ctx.method);
        case 'header':
          return this.evaluateHeaderCondition(condition, ctx);
        case 'custom':
          return this.evaluateCustomCondition(condition, ctx, context);
        default:
          Logger.Warn(`Unknown condition type: ${condition.type}`);
          return true;
      }
    });
  }

  /**
   * Evaluate path condition with optimized matching
   */
  private evaluatePathCondition(condition: MiddlewareCondition, path: string): boolean {
    const { value, operator = 'equals' } = condition;
    
    if (typeof value === 'string') {
      switch (operator) {
        case 'equals':
          // 使用Set进行O(1)查找
          return this.pathPatterns.exact.has(value) ? path === value : path === value;
        case 'contains':
          // 优先使用前缀匹配
          if (this.pathPatterns.prefixes.has(value)) {
            return path.startsWith(value);
          }
          return path.includes(value);
        case 'matches':
          // 使用预编译的正则表达式
          const regex = this.pathPatterns.patterns.get(value);
          if (regex) {
            return regex.test(path);
          }
          // 回退到动态创建正则表达式
          try {
            return new RegExp(value).test(path);
          } catch {
            return false;
          }
        default:
          return false;
      }
    } else if (value instanceof RegExp) {
      return value.test(path);
    }
    
    return false;
  }

  /**
   * Evaluate method condition with caching
   */
  private evaluateMethodCondition(condition: MiddlewareCondition, method: string): boolean {
    const { value } = condition;
    
    if (typeof value === 'string') {
      const expectedMethod = value.toUpperCase();
      const actualMethod = method.toUpperCase();
      
      // 使用缓存的方法集合进行快速查找
      if (this.methodCache.has(expectedMethod)) {
        return actualMethod === expectedMethod;
      }
      
      return actualMethod === expectedMethod;
    }
    
    return false;
  }

  /**
   * Evaluate header condition with caching
   */
  private evaluateHeaderCondition(condition: MiddlewareCondition, ctx: KoattyContext): boolean {
    const { value, operator = 'equals' } = condition;
    
    if (typeof value === 'string') {
      const [headerName, expectedValue] = value.split(':');
      const headerValue = ctx.get(headerName);
      
      if (!expectedValue) {
        return !!headerValue; // Check if header exists
      }
      
      // 使用缓存的头部信息进行快速查找
      const cachedHeaders = this.headerCache.get(headerName.toLowerCase());
      if (cachedHeaders && cachedHeaders.has(expectedValue)) {
        switch (operator) {
          case 'equals':
            return headerValue === expectedValue;
          case 'contains':
            return headerValue.includes(expectedValue);
          case 'matches':
            try {
              return new RegExp(expectedValue).test(headerValue);
            } catch {
              return false;
            }
          default:
            return false;
        }
      }
      
      // 回退到直接比较
      switch (operator) {
        case 'equals':
          return headerValue === expectedValue;
        case 'contains':
          return headerValue.includes(expectedValue);
        case 'matches':
          try {
            return new RegExp(expectedValue).test(headerValue);
          } catch {
            return false;
          }
        default:
          return false;
      }
    }
    
    return false;
  }

  /**
   * Evaluate custom condition
   */
  private evaluateCustomCondition(
    condition: MiddlewareCondition, 
    ctx: KoattyContext,
    _context?: MiddlewareExecutionContext
  ): boolean {
    const { value } = condition;
    
    if (typeof value === 'function') {
      try {
        return value(ctx);
      } catch (error) {
        Logger.Error('Error evaluating custom condition:', error);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Wrap middleware with execution tracking
   */
  private wrapMiddleware(config: MiddlewareConfig): Middleware<KoattyContext> {
    return async (ctx: KoattyContext, next: KoattyNext) => {
      const start = Date.now();
      let stats = this.executionStats.get(config.name);
      
      if (!stats) {
        stats = { executions: 0, totalTime: 0, errors: 0 };
        this.executionStats.set(config.name, stats);
      }

      try {
        stats.executions++;
        await config.middleware(ctx, next);
        stats.totalTime += Date.now() - start;
      } catch (error) {
        stats.errors++;
        stats.totalTime += Date.now() - start;
        throw error;
      }
    };
  }

  /**
   * Get execution statistics
   */
  public getStats(name?: string): Record<string, any> {
    if (name) {
      return this.executionStats.get(name) || {};
    }
    
    const allStats: Record<string, any> = {};
    for (const [middlewareName, stats] of this.executionStats) {
      allStats[middlewareName] = {
        ...stats,
        avgTime: stats.executions > 0 ? stats.totalTime / stats.executions : 0
      };
    }
    
    return allStats;
  }

  /**
   * Clear statistics
   */
  public clearStats(): void {
    this.executionStats.clear();
    Logger.Debug('Cleared middleware execution statistics');
  }

  /**
   * Clear caches to free memory
   */
  public clearCaches(): void {
    this.pathPatterns.exact.clear();
    this.pathPatterns.prefixes.clear();
    this.pathPatterns.suffixes.clear();
    this.pathPatterns.patterns.clear();
    this.methodCache.clear();
    this.headerCache.clear();
    Logger.Debug('Cleared middleware caches');
  }

  /**
   * Create middleware group
   */
  public createGroup(groupName: string, middlewareNames: string[]): void {
    const groupMiddleware = this.compose(middlewareNames);
    
    this.register({
      name: groupName,
      middleware: groupMiddleware,
      metadata: {
        type: 'group',
        members: middlewareNames
      }
    });
  }
}

/**
 * Middleware builder for fluent API
 */
export class MiddlewareBuilder {
  private config: Partial<MiddlewareConfig> = {};

  public name(name: string): this {
    this.config.name = name;
    return this;
  }

  public priority(priority: number): this {
    this.config.priority = priority;
    return this;
  }

  public enabled(enabled: boolean): this {
    this.config.enabled = enabled;
    return this;
  }

  public middleware(middleware: MiddlewareFunction): this {
    this.config.middleware = middleware;
    return this;
  }

  public condition(condition: MiddlewareCondition): this {
    if (!this.config.conditions) {
      this.config.conditions = [];
    }
    this.config.conditions.push(condition);
    return this;
  }

  public metadata(key: string, value: any): this {
    if (!this.config.metadata) {
      this.config.metadata = {};
    }
    this.config.metadata[key] = value;
    return this;
  }

  public build(): MiddlewareConfig {
    if (!this.config.name || !this.config.middleware) {
      throw new Error('Middleware name and function are required');
    }
    
    return this.config as MiddlewareConfig;
  }

  public register(): void {
    const manager = MiddlewareManager.getInstance();
    manager.register(this.build());
  }
}

/**
 * Decorator for auto-registering middlewares
 */
export function RegisterMiddleware(config: Omit<MiddlewareConfig, 'middleware'>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const middleware = descriptor.value;
    
    if (typeof middleware !== 'function') {
      throw new Error('Decorated method must be a function');
    }

    const manager = MiddlewareManager.getInstance();
    manager.register({
      ...config,
      middleware
    });

    return descriptor;
  };
} 