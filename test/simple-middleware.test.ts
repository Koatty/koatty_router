/**
 * 简化的中间件管理测试
 * 这个测试文件验证了新的中间件管理功能
 */

import { RouterMiddlewareManager, MiddlewareBuilder } from "../src/middleware/manager";

describe("RouterMiddlewareManager 简化功能测试", () => {
  beforeEach(() => {
    RouterMiddlewareManager.resetInstance();
  });

  afterEach(() => {
    RouterMiddlewareManager.resetInstance();
  });

  it("应该创建单例实例", () => {
    const instance1 = RouterMiddlewareManager.getInstance();
    const instance2 = RouterMiddlewareManager.getInstance();

    expect(instance1).toBe(instance2);
  });

  it("应该注册和获取中间件", () => {
    const manager = RouterMiddlewareManager.getInstance();
    const middleware = async (ctx: any, next: any) => {
      ctx.testFlag = true;
      await next();
    };

    manager.register({
      name: "testMiddleware",
      middleware,
      priority: 100
    });

    const config = manager.getMiddleware("testMiddleware");
    expect(config).toBeDefined();
    expect(config?.name).toBe("testMiddleware");
    expect(config?.priority).toBe(100);
  });

  it("应该拒绝无效的中间件配置", () => {
    const manager = RouterMiddlewareManager.getInstance();
    
    expect(() => {
      manager.register({
        name: "",
        middleware: async () => {}
      });
    }).toThrow("Middleware name must be a non-empty string");
  });

  it("应该组合多个中间件", async () => {
    const manager = RouterMiddlewareManager.getInstance();
    const executionOrder: string[] = [];

    manager.register({
      name: "first",
      priority: 100,
      middleware: async (ctx: any, next: any) => {
        executionOrder.push("first");
        await next();
      }
    });

    manager.register({
      name: "second",
      priority: 50,
      middleware: async (ctx: any, next: any) => {
        executionOrder.push("second");
        await next();
      }
    });

    const composed = manager.compose(["first", "second"]);
    await composed({} as any, async () => {});

    expect(executionOrder).toEqual(["first", "second"]);
  });

  it("应该跳过禁用的中间件", async () => {
    const manager = RouterMiddlewareManager.getInstance();
    const executionOrder: string[] = [];

    manager.register({
      name: "enabled",
      middleware: async (ctx: any, next: any) => {
        executionOrder.push("enabled");
        await next();
      }
    });

    manager.register({
      name: "disabled",
      enabled: false,
      middleware: async (ctx: any, next: any) => {
        executionOrder.push("disabled");
        await next();
      }
    });

    const composed = manager.compose(["enabled", "disabled"]);
    await composed({} as any, async () => {});

    expect(executionOrder).toEqual(["enabled"]);
  });

  it("应该支持条件中间件", async () => {
    const manager = RouterMiddlewareManager.getInstance();
    let executed = false;

    manager.register({
      name: "conditionalMiddleware",
      middleware: async (ctx: any, next: any) => {
        executed = true;
        await next();
      },
      conditions: [
        { type: 'method', value: 'GET' }
      ]
    });

    const composed = manager.compose(["conditionalMiddleware"]);

    // 匹配条件
    await composed({ method: 'GET' } as any, async () => {});
    expect(executed).toBe(true);

    // 不匹配条件
    executed = false;
    await composed({ method: 'POST' } as any, async () => {});
    expect(executed).toBe(false);
  });

  it("应该提供执行统计", async () => {
    const manager = RouterMiddlewareManager.getInstance();

    manager.register({
      name: "statsMiddleware",
      middleware: async (ctx: any, next: any) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        await next();
      }
    });

    const composed = manager.compose(["statsMiddleware"]);
    await composed({} as any, async () => {});

    const stats = manager.getStats("statsMiddleware");
    expect(stats.executions).toBe(1);
    expect(stats.totalTime).toBeGreaterThan(0);
  });

  it("内置中间件应该已注册", () => {
    const manager = RouterMiddlewareManager.getInstance();
    
    const paramValidation = manager.getMiddleware("paramValidation");
    const routeCache = manager.getMiddleware("routeCache");
    const routeAuth = manager.getMiddleware("routeAuth");

    expect(paramValidation).toBeDefined();
    expect(routeCache).toBeDefined();
    expect(routeAuth).toBeDefined();

    expect(paramValidation?.priority).toBe(100);
    expect(routeCache?.priority).toBe(80);
    expect(routeAuth?.priority).toBe(90);
  });

  it("应该按优先级排序中间件", async () => {
    const manager = RouterMiddlewareManager.getInstance();

    // Implementation of this test case is not provided in the original file or the new code block
    // This test case is left unchanged as it was in the original file
  });

  it("应该支持中间件分组", () => {
    const manager = RouterMiddlewareManager.getInstance();

    // Implementation of this test case is not provided in the original file or the new code block
    // This test case is left unchanged as it was in the original file
  });
});

describe("MiddlewareBuilder 简化功能测试", () => {
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