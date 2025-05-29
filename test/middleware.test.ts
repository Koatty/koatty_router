import { RouterMiddlewareManager, MiddlewareBuilder } from "../src/middleware/manager";
import { injectRouter } from "../src/utils/inject";
import { Handler } from "../src/utils/handler";
import { App } from "./app";
import { TestMiddlewareController } from "./controller/TestMiddlewareController";
import { KoattyContext } from "koatty_core";

describe("RouterMiddlewareManager", () => {
  let middlewareManager: RouterMiddlewareManager;
  let app: any;

  beforeEach(() => {
    // 重置单例实例
    RouterMiddlewareManager.resetInstance();
    middlewareManager = RouterMiddlewareManager.getInstance();
    process.env.APP_PATH = "./test";
    app = new App("");
  });

  afterEach(() => {
    // 清理
    RouterMiddlewareManager.resetInstance();
  });

  describe("单例模式", () => {
    it("应该返回相同的实例", () => {
      const instance1 = RouterMiddlewareManager.getInstance();
      const instance2 = RouterMiddlewareManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("应该阻止直接实例化", () => {
      expect(() => new (RouterMiddlewareManager as any)()).toThrow();
    });
  });

  describe("中间件注册", () => {
    test("应该成功注册中间件", () => {
      const middleware = async (ctx: any, next: any) => {
        ctx.testFlag = true;
        await next();
      };

      middlewareManager.register({
        name: "testMiddleware",
        middleware,
        priority: 100
      });

      const config = middlewareManager.getMiddleware("testMiddleware");
      expect(config).toBeDefined();
      expect(config?.name).toBe("testMiddleware");
      expect(config?.priority).toBe(100);
    });

    test("应该拒绝无效的中间件配置", () => {
      expect(() => {
        middlewareManager.register({
          name: "",
          middleware: async () => {}
        });
      }).toThrow("Middleware name must be a non-empty string");

      expect(() => {
        middlewareManager.register({
          name: "test",
          middleware: "invalid" as any
        });
      }).toThrow("Middleware must be a function");
    });

    test("应该支持中间件覆盖", () => {
      const middleware1 = async () => {};
      const middleware2 = async () => {};

      middlewareManager.register({
        name: "test",
        middleware: middleware1
      });

      middlewareManager.register({
        name: "test",
        middleware: middleware2
      });

      const config = middlewareManager.getMiddleware("test");
      expect(config?.middleware).toBe(middleware2);
    });
  });

  describe("中间件组合", () => {
    test("应该按优先级排序中间件", async () => {
      const executionOrder: string[] = [];

      middlewareManager.register({
        name: "low",
        priority: 10,
        middleware: async (ctx: any, next: any) => {
          executionOrder.push("low");
          await next();
        }
      });

      middlewareManager.register({
        name: "high",
        priority: 100,
        middleware: async (ctx: any, next: any) => {
          executionOrder.push("high");
          await next();
        }
      });

      middlewareManager.register({
        name: "medium",
        priority: 50,
        middleware: async (ctx: any, next: any) => {
          executionOrder.push("medium");
          await next();
        }
      });

      const composed = middlewareManager.compose(["low", "high", "medium"]);
      const mockCtx = {};
      await composed(mockCtx as any, async () => {});

      expect(executionOrder).toEqual(["high", "medium", "low"]);
    });

    test("应该跳过禁用的中间件", async () => {
      const executionOrder: string[] = [];

      middlewareManager.register({
        name: "enabled",
        middleware: async (ctx: any, next: any) => {
          executionOrder.push("enabled");
          await next();
        }
      });

      middlewareManager.register({
        name: "disabled",
        enabled: false,
        middleware: async (ctx: any, next: any) => {
          executionOrder.push("disabled");
          await next();
        }
      });

      const composed = middlewareManager.compose(["enabled", "disabled"]);
      await composed({} as any, async () => {});

      expect(executionOrder).toEqual(["enabled"]);
    });
  });

  describe("条件中间件", () => {
    test("应该根据路径条件执行中间件", async () => {
      let executed = false;

      middlewareManager.register({
        name: "pathMiddleware",
        middleware: async (ctx: any, next: any) => {
          executed = true;
          await next();
        },
        conditions: [
          { type: 'path', value: '/api/test' }
        ]
      });

      const composed = middlewareManager.compose(["pathMiddleware"]);

      // 匹配路径
      await composed({ path: '/api/test' } as any, async () => {});
      expect(executed).toBe(true);

      // 不匹配路径
      executed = false;
      await composed({ path: '/other' } as any, async () => {});
      expect(executed).toBe(false);
    });

    test("应该根据请求方法条件执行中间件", async () => {
      let executed = false;

      middlewareManager.register({
        name: "methodMiddleware",
        middleware: async (ctx: any, next: any) => {
          executed = true;
          await next();
        },
        conditions: [
          { type: 'method', value: 'GET' }
        ]
      });

      const composed = middlewareManager.compose(["methodMiddleware"]);

      // 匹配方法
      await composed({ method: 'GET' } as any, async () => {});
      expect(executed).toBe(true);

      // 不匹配方法
      executed = false;
      await composed({ method: 'POST' } as any, async () => {});
      expect(executed).toBe(false);
    });
  });

  describe("性能统计", () => {
    test("应该记录中间件执行统计", async () => {
      middlewareManager.register({
        name: "statsMiddleware",
        middleware: async (ctx: any, next: any) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          await next();
        }
      });

      const composed = middlewareManager.compose(["statsMiddleware"]);
      await composed({} as any, async () => {});

      const stats = middlewareManager.getStats("statsMiddleware");
      expect(stats.executions).toBe(1);
      expect(stats.totalTime).toBeGreaterThan(0);
      expect(stats.errors).toBe(0);
    });

    test("应该记录中间件错误统计", async () => {
      middlewareManager.register({
        name: "errorMiddleware",
        middleware: async () => {
          throw new Error("Test error");
        }
      });

      const composed = middlewareManager.compose(["errorMiddleware"]);
      
      try {
        await composed({} as any, async () => {});
      } catch (error) {
        // 预期的错误
      }

      const stats = middlewareManager.getStats("errorMiddleware");
      expect(stats.executions).toBe(1);
      expect(stats.errors).toBe(1);
    });
  });
});

describe("MiddlewareBuilder", () => {
  test("应该使用流式API构建中间件", () => {
    const middleware = async (ctx: any, next: any) => await next();

    const config = new MiddlewareBuilder()
      .name("builderTest")
      .priority(80)
      .enabled(true)
      .middleware(middleware)
      .condition({ type: 'method', value: 'GET' })
      .metadata("description", "Test middleware")
      .build();

    expect(config.name).toBe("builderTest");
    expect(config.priority).toBe(80);
    expect(config.enabled).toBe(true);
    expect(config.middleware).toBe(middleware);
    expect(config.conditions).toHaveLength(1);
    expect(config.metadata?.description).toBe("Test middleware");
  });

  test("应该验证必需字段", () => {
    expect(() => {
      new MiddlewareBuilder().build();
    }).toThrow("Middleware name and function are required");
  });
});

describe("集成测试", () => {
  let app: any;

  beforeEach(() => {
    RouterMiddlewareManager.resetInstance();
    process.env.APP_PATH = "./test";
    app = new App("");
  });

  afterEach(() => {
    RouterMiddlewareManager.resetInstance();
  });

  test("应该正确注入路由和中间件", () => {
    const routers = injectRouter(app, TestMiddlewareController);
    expect(routers).toBeDefined();
    
    // 检查路由是否包含中间件
    const routeKey = Object.keys(routers || {})[0];
    if (routeKey && routers) {
      const route = routers[routeKey];
      expect(route.middleware).toBeDefined();
      expect(Array.isArray(route.middleware)).toBe(true);
    }
  });

  test("应该正确执行Handler与中间件", async () => {
    // 注册测试中间件
    const middlewareManager = RouterMiddlewareManager.getInstance();
    let middlewareExecuted = false;

    middlewareManager.register({
      name: "TestMiddleware",
      middleware: async (ctx: any, next: any) => {
        middlewareExecuted = true;
        ctx.middlewareFlag = true;
        await next();
      }
    });

    // 模拟控制器
    const controller = {
      testMethod: () => "test result"
    };

    // 模拟上下文
    const ctx = {
      path: "/test",
      method: "GET",
      protocol: "http",
      throw: jest.fn(),
      body: undefined
    } as any;

    // 执行Handler
    await Handler(app, ctx, controller, "testMethod", [], [], ["TestMiddleware"]);

    expect(middlewareExecuted).toBe(true);
    expect(ctx.middlewareFlag).toBe(true);
    expect(ctx.body).toBe("test result");
  });

  test("应该正确处理内置中间件", () => {
    const middlewareManager = RouterMiddlewareManager.getInstance();
    
    // 检查内置中间件是否已注册
    const paramValidation = middlewareManager.getMiddleware("paramValidation");
    const routeCache = middlewareManager.getMiddleware("routeCache");
    const routeAuth = middlewareManager.getMiddleware("routeAuth");

    expect(paramValidation).toBeDefined();
    expect(routeCache).toBeDefined();
    expect(routeAuth).toBeDefined();

    // 检查内置中间件的配置
    expect(paramValidation?.priority).toBe(100);
    expect(routeCache?.priority).toBe(80);
    expect(routeAuth?.priority).toBe(90);
  });

  test("应该正确处理条件中间件", async () => {
    const middlewareManager = RouterMiddlewareManager.getInstance();
    
    // 获取内置的路由缓存中间件（仅对GET请求生效）
    const routeCache = middlewareManager.getMiddleware("routeCache");
    expect(routeCache?.conditions).toBeDefined();
    expect(routeCache?.conditions?.length).toBeGreaterThan(0);
    
    // 测试条件匹配
    const composed = middlewareManager.compose(["routeCache"]);
    
    let executed = false;
    const originalMiddleware = routeCache?.middleware;
    if (routeCache) {
      routeCache.middleware = async (ctx: any, next: any) => {
        executed = true;
        await next();
      };
    }

    // GET请求应该执行
    await composed({ method: 'GET' } as any, async () => {});
    expect(executed).toBe(true);

    // POST请求不应该执行
    executed = false;
    await composed({ method: 'POST' } as any, async () => {});
    expect(executed).toBe(false);

    // 恢复原始中间件
    if (routeCache && originalMiddleware) {
      routeCache.middleware = originalMiddleware;
    }
  });
}); 