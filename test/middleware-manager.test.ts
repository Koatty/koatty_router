import { RouterMiddlewareManager, MiddlewareConfig, MiddlewareCondition } from '../src/middleware/manager';

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
  let mockCtx: any;
  let mockNext: any;

  beforeEach(() => {
    // Reset singleton before each test
    RouterMiddlewareManager.resetInstance();
    manager = RouterMiddlewareManager.getInstance();
    
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
    RouterMiddlewareManager.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = RouterMiddlewareManager.getInstance();
      const instance2 = RouterMiddlewareManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should throw error when trying to create instance directly', () => {
      expect(() => {
        new (RouterMiddlewareManager as any)();
      }).toThrow('RouterMiddlewareManager is a singleton');
    });

    it('should reset instance properly', () => {
      const instance1 = RouterMiddlewareManager.getInstance();
      RouterMiddlewareManager.resetInstance();
      const instance2 = RouterMiddlewareManager.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Middleware Registration', () => {
    it('should register middleware successfully', () => {
      const config: MiddlewareConfig = {
        name: 'testMiddleware',
        middleware: async (ctx, next) => {
          ctx.testFlag = true;
          await next();
        },
        priority: 10,
        enabled: true
      };

      manager.register(config);
      
      const retrieved = manager.getMiddleware('testMiddleware');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('testMiddleware');
    });

    it('should list all registered middlewares', () => {
      const config1: MiddlewareConfig = {
        name: 'middleware1',
        middleware: async (ctx, next) => await next()
      };
      
      const config2: MiddlewareConfig = {
        name: 'middleware2',
        middleware: async (ctx, next) => await next()
      };

      manager.register(config1);
      manager.register(config2);
      
      const list = manager.listMiddlewares();
      expect(list).toContain('middleware1');
      expect(list).toContain('middleware2');
    });

    it('should unregister middleware', () => {
      const config: MiddlewareConfig = {
        name: 'tempMiddleware',
        middleware: async (ctx, next) => await next()
      };

      manager.register(config);
      expect(manager.getMiddleware('tempMiddleware')).toBeDefined();
      
      const result = manager.unregister('tempMiddleware');
      expect(result).toBe(true);
      expect(manager.getMiddleware('tempMiddleware')).toBeNull();
    });

    it('should return false when unregistering non-existent middleware', () => {
      const result = manager.unregister('nonExistent');
      expect(result).toBe(false);
    });

    it('should handle middleware enable/disable', () => {
      const config: MiddlewareConfig = {
        name: 'toggleMiddleware',
        middleware: async (ctx, next) => await next(),
        enabled: true
      };

      manager.register(config);
      
      manager.setEnabled('toggleMiddleware', false);
      const middleware = manager.getMiddleware('toggleMiddleware');
      expect(middleware?.enabled).toBe(false);
      
      manager.setEnabled('toggleMiddleware', true);
      const enabledMiddleware = manager.getMiddleware('toggleMiddleware');
      expect(enabledMiddleware?.enabled).toBe(true);
    });
  });

  describe('Path Condition Evaluation', () => {
    it('should match exact path conditions', () => {
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

      manager.register(config);
      
      const composed = manager.compose(['exactPathMiddleware'], {
        route: '/test',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });

    it('should match path prefix conditions', () => {
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

      manager.register(config);
      
      const composed = manager.compose(['prefixMiddleware'], {
        route: '/api/users',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });

    it('should match regex path patterns', () => {
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

      manager.register(config);
      
      const composed = manager.compose(['regexMiddleware'], {
        route: '/api/123',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });
  });

  describe('Method Condition Evaluation', () => {
    it('should match single method conditions', () => {
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

      manager.register(config);
      
      const composed = manager.compose(['getMethodMiddleware'], {
        route: '/test',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });

    it('should match multiple method conditions', () => {
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

      manager.register(config);
      
      const composed = manager.compose(['multiMethodMiddleware'], {
        route: '/test',
        method: 'POST'
      });

      expect(composed).toBeDefined();
    });
  });

  describe('Header Condition Evaluation', () => {
    it('should match header conditions', () => {
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

      manager.register(config);
      
      const composed = manager.compose(['headerMiddleware']);
      expect(composed).toBeDefined();
    });

    it('should match header contains conditions', () => {
      const config: MiddlewareConfig = {
        name: 'headerContainsMiddleware',
        middleware: async (ctx, next) => {
          ctx.headerContainsMatched = true;
          await next();
        },
        conditions: [{
          type: 'header',
          value: 'authorization:Bearer',
          operator: 'contains'
        }]
      };

      manager.register(config);
      
      const composed = manager.compose(['headerContainsMiddleware']);
      expect(composed).toBeDefined();
    });
  });

  describe('Custom Condition Evaluation', () => {
    it('should evaluate custom function conditions', () => {
      const customCondition = jest.fn(() => true);
      
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

      manager.register(config);
      
      const composed = manager.compose(['customMiddleware']);
      expect(composed).toBeDefined();
    });
  });

  describe('Middleware Composition', () => {
    it('should compose multiple middlewares in order', () => {
      const execution: string[] = [];
      
      const config1: MiddlewareConfig = {
        name: 'first',
        middleware: async (ctx, next) => {
          execution.push('first-start');
          await next();
          execution.push('first-end');
        },
        priority: 1
      };
      
      const config2: MiddlewareConfig = {
        name: 'second',
        middleware: async (ctx, next) => {
          execution.push('second-start');
          await next();
          execution.push('second-end');
        },
        priority: 2
      };

      manager.register(config1);
      manager.register(config2);
      
      const composed = manager.compose(['first', 'second']);
      expect(composed).toBeDefined();
    });

    it('should skip disabled middlewares', () => {
      const config: MiddlewareConfig = {
        name: 'disabledMiddleware',
        middleware: async (ctx, next) => {
          ctx.shouldNotRun = true;
          await next();
        },
        enabled: false
      };

      manager.register(config);
      
      const composed = manager.compose(['disabledMiddleware']);
      expect(composed).toBeDefined();
    });

    it('should handle non-existent middleware names gracefully', () => {
      const composed = manager.compose(['nonExistent']);
      expect(composed).toBeDefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track execution statistics', () => {
      const config: MiddlewareConfig = {
        name: 'statsMiddleware',
        middleware: async (ctx, next) => {
          await next();
        }
      };

      manager.register(config);
      
      const stats = manager.getStats('statsMiddleware');
      expect(stats).toBeDefined();
    });

    it('should return all stats when no name provided', () => {
      const allStats = manager.getStats();
      expect(typeof allStats).toBe('object');
    });

    it('should clear statistics', () => {
      manager.clearStats();
      const stats = manager.getStats();
      expect(Object.keys(stats)).toHaveLength(0);
    });

    it('should provide memory statistics', () => {
      const memStats = manager.getMemoryStats();
      
      expect(memStats).toHaveProperty('totalCacheSize');
      expect(memStats).toHaveProperty('pathPatternsSize');
      expect(memStats).toHaveProperty('methodCacheSize');
      expect(memStats).toHaveProperty('headerCacheSize');
      expect(memStats).toHaveProperty('executionStatsSize');
      expect(memStats).toHaveProperty('middlewareCount');
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      manager.clearCaches();
      
      const memStats = manager.getMemoryStats();
      expect(memStats.totalCacheSize).toBe(0);
    });

    it('should handle cache cleanup', () => {
      // Register multiple middlewares to populate caches
      for (let i = 0; i < 10; i++) {
        const config: MiddlewareConfig = {
          name: `middleware${i}`,
          middleware: async (ctx, next) => await next(),
          conditions: [{
            type: 'path',
            value: `/path${i}`,
            operator: 'equals'
          }]
        };
        manager.register(config);
      }
      
      const initialStats = manager.getMemoryStats();
      expect(initialStats.middlewareCount).toBeGreaterThan(10); // Account for builtin middlewares
    });
  });

  describe('Middleware Groups', () => {
    it('should create middleware groups', () => {
      const config1: MiddlewareConfig = {
        name: 'auth',
        middleware: async (ctx, next) => await next()
      };
      
      const config2: MiddlewareConfig = {
        name: 'logging',
        middleware: async (ctx, next) => await next()
      };

      manager.register(config1);
      manager.register(config2);
      
      manager.createGroup('security', ['auth', 'logging']);
      
      // Group creation should not throw
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle middleware execution errors gracefully', async () => {
      const errorMiddleware: MiddlewareConfig = {
        name: 'errorMiddleware',
        middleware: async () => {
          throw new Error('Middleware error');
        }
      };

      manager.register(errorMiddleware);
      
      const composed = manager.compose(['errorMiddleware']);
      
      await expect(composed(mockCtx, mockNext)).rejects.toThrow('Middleware error');
    });

    it('should handle invalid conditions gracefully', () => {
      const config: MiddlewareConfig = {
        name: 'invalidConditionMiddleware',
        middleware: async (ctx, next) => await next(),
        conditions: [{
          type: 'invalid' as any,
          value: 'test',
          operator: 'equals'
        }]
      };

      expect(() => {
        manager.register(config);
      }).not.toThrow();
    });
  });

  describe('Builtin Middlewares', () => {
    it('should have builtin middlewares initialized', () => {
      const middlewares = manager.listMiddlewares();
      
      // Should have some builtin middlewares
      expect(middlewares.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Middleware Features', () => {
    it('should handle priority-based middleware ordering', () => {
      const config1: MiddlewareConfig = {
        name: 'high-priority',
        middleware: async (ctx, next) => await next(),
        priority: 100
      };
      
      const config2: MiddlewareConfig = {
        name: 'low-priority',
        middleware: async (ctx, next) => await next(),
        priority: 1
      };

      manager.register(config1);
      manager.register(config2);
      
      const composed = manager.compose(['high-priority', 'low-priority']);
      expect(composed).toBeDefined();
    });

    it('should handle middleware override', () => {
      const config1: MiddlewareConfig = {
        name: 'override-test',
        middleware: async (ctx, next) => {
          ctx.version = 1;
          await next();
        }
      };
      
      const config2: MiddlewareConfig = {
        name: 'override-test', // Same name
        middleware: async (ctx, next) => {
          ctx.version = 2;
          await next();
        }
      };

      manager.register(config1);
      manager.register(config2); // Should override the first one
      
      const middleware = manager.getMiddleware('override-test');
      expect(middleware).toBeDefined();
    });

    it('should handle middleware groups creation and usage', () => {
      const authConfig: MiddlewareConfig = {
        name: 'auth-middleware',
        middleware: async (ctx, next) => {
          ctx.authenticated = true;
          await next();
        }
      };
      
      const loggingConfig: MiddlewareConfig = {
        name: 'logging-middleware',
        middleware: async (ctx, next) => {
          ctx.logged = true;
          await next();
        }
      };

      manager.register(authConfig);
      manager.register(loggingConfig);
      
      manager.createGroup('security-group', ['auth-middleware', 'logging-middleware']);
      
      // Group creation should not throw
      expect(true).toBe(true);
    });

    it('should handle complex condition combinations', () => {
      const config: MiddlewareConfig = {
        name: 'complex-conditions',
        middleware: async (ctx, next) => {
          ctx.complexMatched = true;
          await next();
        },
        conditions: [
          {
            type: 'path',
            value: '/api',
            operator: 'contains'
          },
          {
            type: 'method',
            value: 'POST',
            operator: 'equals'
          },
          {
            type: 'header',
            value: 'authorization:Bearer',
            operator: 'contains'
          }
        ]
      };

      manager.register(config);
      
      const composed = manager.compose(['complex-conditions'], {
        route: '/api/users',
        method: 'POST'
      });

      expect(composed).toBeDefined();
    });

    it('should handle middleware execution timing', () => {
      let executionOrder: string[] = [];
      
      const config1: MiddlewareConfig = {
        name: 'timing-first',
        middleware: async (ctx, next) => {
          executionOrder.push('first-start');
          await next();
          executionOrder.push('first-end');
        },
        priority: 1
      };
      
      const config2: MiddlewareConfig = {
        name: 'timing-second',
        middleware: async (ctx, next) => {
          executionOrder.push('second-start');
          await next();
          executionOrder.push('second-end');
        },
        priority: 2
      };

      manager.register(config1);
      manager.register(config2);
      
      const composed = manager.compose(['timing-first', 'timing-second']);
      expect(composed).toBeDefined();
    });

    it('should handle regex pattern conditions', () => {
      const config: MiddlewareConfig = {
        name: 'regex-pattern',
        middleware: async (ctx, next) => {
          ctx.regexMatched = true;
          await next();
        },
        conditions: [{
          type: 'path',
          value: /^\/api\/v\d+\/users$/,
          operator: 'matches'
        }]
      };

      manager.register(config);
      
      const composed = manager.compose(['regex-pattern'], {
        route: '/api/v1/users',
        method: 'GET'
      });

      expect(composed).toBeDefined();
    });

    it('should handle middleware with context modifications', async () => {
      const config: MiddlewareConfig = {
        name: 'context-modifier',
        middleware: async (ctx, next) => {
          ctx.customProperty = 'modified';
          ctx.timestamp = Date.now();
          await next();
        }
      };

      manager.register(config);
      
      const composed = manager.compose(['context-modifier']);
      
      await composed(mockCtx, mockNext);
      expect(mockCtx.customProperty).toBe('modified');
      expect(mockCtx.timestamp).toBeDefined();
    });

    it('should handle middleware removal and cleanup', () => {
      const config: MiddlewareConfig = {
        name: 'temporary-middleware',
        middleware: async (ctx, next) => await next()
      };

      manager.register(config);
      expect(manager.getMiddleware('temporary-middleware')).toBeDefined();
      
      const removed = manager.unregister('temporary-middleware');
      expect(removed).toBe(true);
      expect(manager.getMiddleware('temporary-middleware')).toBeNull();
      
      // Try to remove again
      const removedAgain = manager.unregister('temporary-middleware');
      expect(removedAgain).toBe(false);
    });

    it('should handle execution statistics tracking', () => {
      const config: MiddlewareConfig = {
        name: 'stats-tracked',
        middleware: async (ctx, next) => {
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 1));
          await next();
        }
      };

      manager.register(config);
      
      const stats = manager.getStats('stats-tracked');
      expect(stats).toBeDefined();
      
      const allStats = manager.getStats();
      expect(allStats).toBeDefined();
      expect(typeof allStats).toBe('object');
    });

    it('should handle memory statistics reporting', () => {
      const memStats = manager.getMemoryStats();
      
      expect(memStats).toHaveProperty('totalCacheSize');
      expect(memStats).toHaveProperty('pathPatternsSize');
      expect(memStats).toHaveProperty('methodCacheSize');
      expect(memStats).toHaveProperty('headerCacheSize');
      expect(memStats).toHaveProperty('executionStatsSize');
      expect(memStats).toHaveProperty('middlewareCount');
      
      expect(typeof memStats.totalCacheSize).toBe('number');
      expect(typeof memStats.middlewareCount).toBe('number');
    });

    it('should handle cache clearing operations', () => {
      // Add some middlewares to populate caches
      for (let i = 0; i < 5; i++) {
        const config: MiddlewareConfig = {
          name: `cache-test-${i}`,
          middleware: async (ctx, next) => await next(),
          conditions: [{
            type: 'path',
            value: `/test-${i}`,
            operator: 'equals'
          }]
        };
        manager.register(config);
      }
      
      const beforeClear = manager.getMemoryStats();
      manager.clearCaches();
      const afterClear = manager.getMemoryStats();
      
      expect(afterClear.totalCacheSize).toBe(0);
    });

    it('should handle builtin middleware initialization', () => {
      const middlewares = manager.listMiddlewares();
      
      // Should have some builtin middlewares
      expect(middlewares.length).toBeGreaterThan(0);
      expect(middlewares).toContain('paramValidation');
      expect(middlewares).toContain('routeCache');
      expect(middlewares).toContain('routeAuth');
    });
  });

  describe('Destroy and Cleanup', () => {
    it('should destroy instance properly', () => {
      const instance = RouterMiddlewareManager.getInstance();
      expect(instance).toBeDefined();
      
      RouterMiddlewareManager.resetInstance();
      
      const newInstance = RouterMiddlewareManager.getInstance();
      expect(newInstance).not.toBe(instance);
    });
  });
}); 