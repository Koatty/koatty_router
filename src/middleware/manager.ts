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
import { LRUCache } from "lru-cache";

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
 * Path pattern cache for optimized matching with memory management
 */
interface PathPattern {
  exact: LRUCache<string, boolean>;           // 精确匹配的路径
  prefixes: LRUCache<string, boolean>;        // 前缀匹配的路径
  suffixes: LRUCache<string, boolean>;        // 后缀匹配的路径
  patterns: LRUCache<string, RegExp>;         // 复杂模式的正则表达式
}

/**
 * Router middleware manager interface
 * Defines the contract for managing router-level middleware
 */
export interface IRouterMiddlewareManager {
  register(config: MiddlewareConfig): void;
  unregister(name: string): boolean;
  getMiddleware(name: string): MiddlewareConfig | null;
  listMiddlewares(): string[];
  compose(names: string[], context?: MiddlewareExecutionContext): MiddlewareFunction;
}

/**
 * Router middleware manager implementation
 * Manages router-level middleware registration, composition, and conditional execution
 */
export class RouterMiddlewareManager implements IRouterMiddlewareManager {
  private static instance: RouterMiddlewareManager | null = null;
  private static isCreating = false;
  private readonly _instanceId: string;
  private middlewares = new Map<string, MiddlewareConfig>();
  private executionStats = new Map<string, {
    executions: number;
    totalTime: number;
    errors: number;
  }>();
  
  // 优化的路径匹配缓存 - 使用LRU缓存防止内存泄漏
  private pathPatterns: PathPattern = {
    exact: new LRUCache<string, boolean>({ max: 200 }),
    prefixes: new LRUCache<string, boolean>({ max: 100 }),
    suffixes: new LRUCache<string, boolean>({ max: 100 }),
    patterns: new LRUCache<string, RegExp>({ max: 50 })
  };
  
  // 方法匹配缓存 - 限制大小
  private methodCache = new LRUCache<string, Set<string>>({ max: 100 });
  
  // 头部匹配缓存 - 限制大小
  private headerCache = new LRUCache<string, Map<string, string>>({ max: 100 });

  // 缓存清理定时器
  private cacheCleanupTimer?: NodeJS.Timeout;
  private readonly CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    if (RouterMiddlewareManager.instance) {
      throw new Error('RouterMiddlewareManager is a singleton. Use getInstance() instead.');
    }
    this._instanceId = Math.random().toString(36).substr(2, 9);
    Logger.Debug(`RouterMiddlewareManager instance created with ID: ${this._instanceId}`);
    this.initializeBuiltinMiddlewares();
    this.startCacheCleanup();
  }

  /**
   * Get singleton instance
   * @returns RouterMiddlewareManager instance
   */
  public static getInstance(): RouterMiddlewareManager {
    if (RouterMiddlewareManager.instance) {
      return RouterMiddlewareManager.instance;
    }

    if (RouterMiddlewareManager.isCreating) {
      throw new Error('RouterMiddlewareManager is already being created');
    }

    RouterMiddlewareManager.isCreating = true;
    try {
      RouterMiddlewareManager.instance = new RouterMiddlewareManager();
      Logger.Debug('RouterMiddlewareManager singleton instance initialized');
    } finally {
      RouterMiddlewareManager.isCreating = false;
    }

    return RouterMiddlewareManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (RouterMiddlewareManager.instance) {
      RouterMiddlewareManager.instance.destroy();
    }
    RouterMiddlewareManager.instance = null;
    RouterMiddlewareManager.isCreating = false;
    Logger.Debug('RouterMiddlewareManager singleton instance reset');
  }

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanup(): void {
    this.cacheCleanupTimer = setInterval(() => {
      this.performCacheCleanup();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Perform periodic cache cleanup
   */
  private performCacheCleanup(): void {
    const beforeSize = this.getCacheSize();
    
    // 清理执行统计中的过期数据
    this.cleanupExecutionStats();
    
    const afterSize = this.getCacheSize();
    Logger.Debug(`Cache cleanup completed. Size: ${beforeSize} -> ${afterSize}`);
  }

  /**
   * Clean up old execution statistics
   */
  private cleanupExecutionStats(): void {
    const maxStatsEntries = 1000;
    if (this.executionStats.size > maxStatsEntries) {
      const entries = Array.from(this.executionStats.entries());
      // 保留最近使用的统计数据
      entries.sort((a, b) => b[1].executions - a[1].executions);
      
      this.executionStats.clear();
      entries.slice(0, maxStatsEntries / 2).forEach(([key, value]) => {
        this.executionStats.set(key, value);
      });
    }
  }

  /**
   * Get total cache size
   */
  private getCacheSize(): number {
    return this.pathPatterns.exact.size +
           this.pathPatterns.prefixes.size +
           this.pathPatterns.suffixes.size +
           this.pathPatterns.patterns.size +
           this.methodCache.size +
           this.headerCache.size +
           this.executionStats.size;
  }

  /**
   * Destroy manager and cleanup resources
   */
  public destroy(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = undefined;
    }
    
    this.clearCaches();
    this.middlewares.clear();
    this.executionStats.clear();
    
    Logger.Debug(`RouterMiddlewareManager instance ${this._instanceId} destroyed`);
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
        this.pathPatterns.exact.set(path, true);
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
  public getMiddleware(name: string): MiddlewareConfig | null {
    return this.middlewares.get(name) || null;
  }

  /**
   * List all middlewares
   */
  public listMiddlewares(): string[] {
    return Array.from(this.middlewares.keys());
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
      .map(name => this.middlewares.get(name))
      .filter((config): config is MiddlewareConfig => 
        config !== undefined && config.enabled !== false
      )
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (validConfigs.length === 0) {
      return async (ctx: KoattyContext, next: KoattyNext) => {
        await next();
      };
    }

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
          // 使用LRU缓存进行O(1)查找
          const exactMatch = this.pathPatterns.exact.get(value);
          if (exactMatch !== undefined) {
            return path === value;
          }
          // 如果缓存中没有，检查并缓存结果
          const isMatch = path === value;
          this.pathPatterns.exact.set(value, isMatch);
          return isMatch;
          
        case 'contains':
          // 优先使用前缀匹配缓存
          const prefixMatch = this.pathPatterns.prefixes.get(value);
          if (prefixMatch !== undefined) {
            return path.startsWith(value);
          }
          // 检查并缓存前缀匹配结果
          const isPrefixMatch = path.startsWith(value) || path.includes(value);
          this.pathPatterns.prefixes.set(value, isPrefixMatch);
          return isPrefixMatch;
          
        case 'matches':
          // 使用预编译的正则表达式缓存
          let regex = this.pathPatterns.patterns.get(value);
          if (!regex) {
            try {
              regex = new RegExp(value);
              this.pathPatterns.patterns.set(value, regex);
            } catch {
              return false;
            }
          }
          return regex.test(path);
          
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
    const { value, operator = 'equals' } = condition;
    
    if (typeof value === 'string') {
      const targetMethod = value.toUpperCase();
      const currentMethod = method.toUpperCase();
      
      // 使用缓存检查方法匹配
      let methodSet = this.methodCache.get(targetMethod);
      if (!methodSet) {
        methodSet = new Set<string>();
        this.methodCache.set(targetMethod, methodSet);
      }
      
      if (methodSet.has(currentMethod)) {
        return true;
      }
      
      const isMatch = operator === 'equals' ? 
        currentMethod === targetMethod : 
        currentMethod.includes(targetMethod);
        
      if (isMatch) {
        methodSet.add(currentMethod);
      }
      
      return isMatch;
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
      if (!headerName) return false;
      
      const normalizedHeaderName = headerName.toLowerCase();
      const actualValue = ctx.headers[normalizedHeaderName];
      
      if (!actualValue) return false;
      
      // 处理头部值可能是数组的情况
      const actualValueStr = Array.isArray(actualValue) ? actualValue[0] : actualValue;
      if (!actualValueStr) return false;
      
      // 使用缓存检查头部匹配
      let headerMap = this.headerCache.get(normalizedHeaderName);
      if (!headerMap) {
        headerMap = new Map<string, string>();
        this.headerCache.set(normalizedHeaderName, headerMap);
      }
      
      if (expectedValue) {
        const cachedResult = headerMap.get(expectedValue);
        if (cachedResult !== undefined) {
          return actualValueStr === expectedValue;
        }
        
        const isMatch = operator === 'equals' ? 
          actualValueStr === expectedValue :
          operator === 'contains' ?
          actualValueStr.includes(expectedValue) :
          false;
          
        if (isMatch) {
          headerMap.set(expectedValue, actualValueStr);
        }
        
        return isMatch;
      } else {
        // 只检查头部是否存在
        return true;
      }
    } else if (typeof value === 'function') {
      return value(ctx);
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
   * Clear all caches with proper cleanup
   */
  public clearCaches(): void {
    this.pathPatterns.exact.clear();
    this.pathPatterns.prefixes.clear();
    this.pathPatterns.suffixes.clear();
    this.pathPatterns.patterns.clear();
    this.methodCache.clear();
    this.headerCache.clear();
    
    Logger.Debug('All caches cleared');
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): {
    totalCacheSize: number;
    pathPatternsSize: number;
    methodCacheSize: number;
    headerCacheSize: number;
    executionStatsSize: number;
    middlewareCount: number;
  } {
    return {
      totalCacheSize: this.getCacheSize(),
      pathPatternsSize: this.pathPatterns.exact.size + 
                       this.pathPatterns.prefixes.size + 
                       this.pathPatterns.suffixes.size + 
                       this.pathPatterns.patterns.size,
      methodCacheSize: this.methodCache.size,
      headerCacheSize: this.headerCache.size,
      executionStatsSize: this.executionStats.size,
      middlewareCount: this.middlewares.size
    };
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
    const manager = RouterMiddlewareManager.getInstance();
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

    const manager = RouterMiddlewareManager.getInstance();
    manager.register({
      ...config,
      middleware
    });

    return descriptor;
  };
} 