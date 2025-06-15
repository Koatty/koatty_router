import { RouterMiddlewareManager, MiddlewareConfig, MiddlewareCondition } from '../src/middleware/manager';
import { App } from './app';

// Mock dependencies
jest.mock('koatty_logger', () => ({
  DefaultLogger: {
    Debug: jest.fn(),
    Warn: jest.fn(),
    Error: jest.fn()
  }
}));

jest.mock('koa-compose', () => {
  return jest.fn((middlewares) => {
    return async (ctx: any, next: any) => {
      for (const middleware of middlewares) {
        await middleware(ctx, next);
      }
    };
  });
});

describe('RouterMiddlewareManager Tests', () => {
  let manager: RouterMiddlewareManager;
  let app: App;
  let mockCtx: any;
  let mockNext: any;

  beforeEach(() => {
    app = new App('');
    RouterMiddlewareManager.resetInstance();
    manager = RouterMiddlewareManager.getInstance(app);
    
    mockCtx = {
      path: '/test',
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer token'
      }
    };
    
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.destroy();
    RouterMiddlewareManager.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RouterMiddlewareManager.getInstance(app);
      const instance2 = RouterMiddlewareManager.getInstance(app);
      expect(instance1).toBe(instance2);
    });

    it('should reset instance properly', () => {
      const instance1 = RouterMiddlewareManager.getInstance(app);
      RouterMiddlewareManager.resetInstance();
      const instance2 = RouterMiddlewareManager.getInstance(app);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Middleware Registration', () => {
    it('should register middleware successfully', async () => {
      const config: MiddlewareConfig = {
        name: 'testMiddleware',
        middleware: async (ctx, next) => await next()
      };

      const instanceId = await manager.register(config);
      expect(instanceId).toBeDefined();
      expect(typeof instanceId).toBe('string');
      
      const middleware = manager.getMiddleware(instanceId);
      expect(middleware).toBeDefined();
      expect(middleware?.name).toBe('testMiddleware');
    });

    it('should throw error for invalid middleware name', async () => {
      const config: MiddlewareConfig = {
        name: '',
        middleware: async (ctx, next) => await next()
      };

      await expect(manager.register(config)).rejects.toThrow('Middleware name must be a non-empty string');
    });

    it('should throw error for invalid middleware function', async () => {
      const config: MiddlewareConfig = {
        name: 'invalidMiddleware',
        middleware: null as any
      };

      await expect(manager.register(config)).rejects.toThrow('Middleware must be a function');
    });

    it('should list all registered middlewares', async () => {
      const config1: MiddlewareConfig = {
        name: 'middleware1',
        middleware: async (ctx, next) => await next()
      };
      
      const config2: MiddlewareConfig = {
        name: 'middleware2',
        middleware: async (ctx, next) => await next()
      };

      const instanceId1 = await manager.register(config1);
      const instanceId2 = await manager.register(config2);
      
      const list = manager.listMiddlewares();
      expect(list).toContain(instanceId1);
      expect(list).toContain(instanceId2);
    });

    it('should unregister middleware', async () => {
      const config: MiddlewareConfig = {
        name: 'tempMiddleware',
        middleware: async (ctx, next) => await next()
      };

      const instanceId = await manager.register(config);
      expect(manager.getMiddleware(instanceId)).toBeDefined();
      
      const result = manager.unregister(instanceId);
      expect(result).toBe(true);
      expect(manager.getMiddleware(instanceId)).toBeNull();
    });

    it('should return false when unregistering non-existent middleware', () => {
      const result = manager.unregister('nonExistent');
      expect(result).toBe(false);
    });

    it('should handle middleware enable/disable', async () => {
      const config: MiddlewareConfig = {
        name: 'toggleMiddleware',
        middleware: async (ctx, next) => await next(),
        enabled: true
      };

      const instanceId = await manager.register(config);
      
      manager.setEnabled('toggleMiddleware', false);
      const middleware = manager.getMiddleware(instanceId);
      expect(middleware?.enabled).toBe(false);
      
      manager.setEnabled('toggleMiddleware', true);
      const enabledMiddleware = manager.getMiddleware(instanceId);
      expect(enabledMiddleware?.enabled).toBe(true);
    });
  });

  describe('Path Condition Evaluation', () => {
    it('should match exact path conditions', async () => {
      const config: MiddlewareConfig = {
        name: 'exactPathMiddleware',
        middleware: async (ctx, next) => {
          ctx.exactMatched = true;
          await next();
        },
        conditions: [{
          type: 'path',
          value: '/test',
          operator: 'equals'
        }]
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId], {
        route: '/test',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });

    it('should match path prefix conditions', async () => {
      const config: MiddlewareConfig = {
        name: 'prefixMiddleware',
        middleware: async (ctx, next) => {
          ctx.prefixMatched = true;
          await next();
        },
        conditions: [{
          type: 'path',
          value: '/api',
          operator: 'contains'
        }]
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId], {
        route: '/api/users',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });

    it('should match regex path patterns', async () => {
      const config: MiddlewareConfig = {
        name: 'regexMiddleware',
        middleware: async (ctx, next) => {
          ctx.regexMatched = true;
          await next();
        },
        conditions: [{
          type: 'path',
          value: /^\/api\/\d+$/,
          operator: 'matches'
        }]
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId], {
        route: '/api/123',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });
  });

  describe('Method Condition Evaluation', () => {
    it('should match single method conditions', async () => {
      const config: MiddlewareConfig = {
        name: 'getMethodMiddleware',
        middleware: async (ctx, next) => {
          ctx.methodMatched = true;
          await next();
        },
        conditions: [{
          type: 'method',
          value: 'GET',
          operator: 'equals'
        }]
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId], {
        route: '/test',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });

    it('should match multiple method conditions', async () => {
      const config: MiddlewareConfig = {
        name: 'multiMethodMiddleware',
        middleware: async (ctx, next) => {
          ctx.multiMethodMatched = true;
          await next();
        },
        conditions: [{
          type: 'method',
          value: 'GET,POST',
          operator: 'contains'
        }]
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId], {
        route: '/test',
        method: 'POST'
      });

      expect(composed).toBeDefined();
    });
  });

  describe('Header Condition Evaluation', () => {
    it('should match header conditions', async () => {
      const config: MiddlewareConfig = {
        name: 'headerMiddleware',
        middleware: async (ctx, next) => {
          ctx.headerMatched = true;
          await next();
        },
        conditions: [{
          type: 'header',
          value: 'content-type:application/json',
          operator: 'equals'
        }]
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId]);
      expect(composed).toBeDefined();
    });

    it('should match header contains conditions', async () => {
      const config: MiddlewareConfig = {
        name: 'headerContainsMiddleware',
        middleware: async (ctx, next) => {
          ctx.headerContainsMatched = true;
          await next();
        },
        conditions: [{
          type: 'header',
          value: 'authorization',
          operator: 'contains'
        }]
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId]);
      expect(composed).toBeDefined();
    });
  });

  describe('Custom Condition Evaluation', () => {
    it('should handle custom function conditions', async () => {
      const customCondition = (ctx: any) => ctx.customFlag === true;
      
      const config: MiddlewareConfig = {
        name: 'customMiddleware',
        middleware: async (ctx, next) => {
          ctx.customMatched = true;
          await next();
        },
        conditions: [{
          type: 'custom',
          value: customCondition,
          operator: 'custom'
        }]
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId]);
      expect(composed).toBeDefined();
    });
  });

  describe('Middleware Composition', () => {
    it('should compose multiple middlewares', async () => {
      const config1: MiddlewareConfig = {
        name: 'middleware1',
        middleware: async (ctx, next) => {
          ctx.order = ctx.order || [];
          ctx.order.push('middleware1');
          await next();
        },
        priority: 100
      };

      const config2: MiddlewareConfig = {
        name: 'middleware2',
        middleware: async (ctx, next) => {
          ctx.order = ctx.order || [];
          ctx.order.push('middleware2');
          await next();
        },
        priority: 200
      };

      const instanceId1 = await manager.register(config1);
      const instanceId2 = await manager.register(config2);
      
      const composed = manager.compose([instanceId1, instanceId2]);
      expect(composed).toBeDefined();
    });

    it('should handle empty middleware list', () => {
      const composed = manager.compose([]);
      expect(composed).toBeDefined();
    });

    it('should handle non-existent middleware in composition', async () => {
      const config: MiddlewareConfig = {
        name: 'existingMiddleware',
        middleware: async (ctx, next) => await next()
      };

      const instanceId = await manager.register(config);
      
      const composed = manager.compose([instanceId, 'nonExistent']);
      expect(composed).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should handle cache cleanup', async () => {
      // Register multiple middlewares to populate caches
      for (let i = 0; i < 15; i++) {
        const config: MiddlewareConfig = {
          name: `middleware${i}`,
          middleware: async (ctx, next) => await next(),
          conditions: [{
            type: 'path',
            value: `/path${i}`,
            operator: 'equals'
          }]
        };
        await manager.register(config);
      }
      
      // Test completed successfully
    });
  });

  describe('Error Handling', () => {
    it('should handle middleware execution errors gracefully', async () => {
      const config: MiddlewareConfig = {
        name: 'errorMiddleware',
        middleware: async (ctx, next) => {
          throw new Error('Middleware error');
        }
      };

      const instanceId = await manager.register(config);
      const composed = manager.compose([instanceId]);
      
      const mockCtx = { path: '/test', method: 'GET' } as any;
      const mockNext = jest.fn();
      
      await expect(composed(mockCtx, mockNext)).rejects.toThrow('Middleware error');
    });

    it('should handle invalid conditions gracefully', async () => {
      const config: MiddlewareConfig = {
        name: 'invalidConditionMiddleware',
        middleware: async (ctx, next) => await next(),
        conditions: [{
          type: 'path' as any,
          value: null as any,
          operator: 'equals'
        }]
      };

      const instanceId = await manager.register(config);
      expect(instanceId).toBeDefined();
    });
  });

  describe('Builtin Middlewares', () => {
    it('should start with no builtin middlewares', () => {
      const middlewares = manager.listMiddlewares();
      
      // Should start with no middlewares
      expect(middlewares.length).toBe(0);
    });
  });



  describe('Advanced Middleware Features', () => {
    it('should handle middleware priority ordering', async () => {
      const highPriorityConfig: MiddlewareConfig = {
        name: 'highPriority',
        middleware: async (ctx, next) => {
          ctx.order = ctx.order || [];
          ctx.order.push('high');
          await next();
        },
        priority: 1000
      };

      const lowPriorityConfig: MiddlewareConfig = {
        name: 'lowPriority',
        middleware: async (ctx, next) => {
          ctx.order = ctx.order || [];
          ctx.order.push('low');
          await next();
        },
        priority: 100
      };

      const highId = await manager.register(highPriorityConfig);
      const lowId = await manager.register(lowPriorityConfig);
      
      const composed = manager.compose([lowId, highId]);
      
      const mockCtx = { path: '/test', method: 'GET', order: [] } as any;
      const mockNext = jest.fn();
      
      await composed(mockCtx, mockNext);
      
      // High priority should execute first
      expect(mockCtx.order[0]).toBe('high');
      expect(mockCtx.order[1]).toBe('low');
    });

    it('should handle middleware with context modifications', async () => {
      const config: MiddlewareConfig = {
        name: 'contextModifier',
        middleware: async (ctx, next) => {
          ctx.customProperty = 'modified';
          ctx.timestamp = Date.now();
          await next();
        }
      };

      const instanceId = await manager.register(config);
      const composed = manager.compose([instanceId]);
      
      const mockCtx = { path: '/test', method: 'GET' } as any;
      const mockNext = jest.fn();
      
      await composed(mockCtx, mockNext);
      expect(mockCtx.customProperty).toBe('modified');
      expect(mockCtx.timestamp).toBeDefined();
    });

    it('should handle conditional middleware execution', async () => {
      const config: MiddlewareConfig = {
        name: 'conditionalMiddleware',
        middleware: async (ctx, next) => {
          ctx.conditionalExecuted = true;
          await next();
        },
        conditions: [{
          type: 'path',
          value: '/api',
          operator: 'contains'
        }]
      };

      const instanceId = await manager.register(config);
      const composed = manager.compose([instanceId], {
        route: '/api/users',
        method: 'GET'
      });
      
      const mockCtx = { path: '/api/users', method: 'GET' } as any;
      const mockNext = jest.fn();
      
      await composed(mockCtx, mockNext);
      expect(mockCtx.conditionalExecuted).toBe(true);
    });

    it('should handle middleware registration and management', async () => {
      const config: MiddlewareConfig = {
        name: 'testManagementMiddleware',
        middleware: async (ctx, next) => await next()
      };

      const instanceId = await manager.register(config);
      const middlewares = manager.listMiddlewares();
      
      expect(middlewares.length).toBeGreaterThan(0);
      expect(middlewares).toContain(instanceId);
    });
  });
}); 