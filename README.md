# koatty_router

Koatty路由组件，支持HTTP1/2、WebSocket、gRPC和GraphQL协议的统一路由管理。

## 特性

- 🚀 **多协议支持** - HTTP、HTTPS、WebSocket、gRPC、GraphQL
- 🏭 **工厂模式** - 灵活的路由器创建和管理
- 🔧 **中间件管理器** - 统一的中间件注册、组合和条件执行
- 📝 **参数验证** - 强大的输入验证和DTO支持
- 🎯 **装饰器支持** - 简洁的路由定义和参数注入
- ⚡ **高性能** - 优化的payload解析和路由匹配
- 🌊 **gRPC流处理** - 完整支持四种gRPC流类型，包括自动检测、背压控制和并发管理

## 安装

```bash
npm install koatty_router
```

## 快速开始

### 基础路由使用

```typescript
import { NewRouter } from "koatty_router";
import { Koatty } from "koatty_core";

const app = new Koatty();

// 创建HTTP路由器
const httpRouter = NewRouter(app, {
  protocol: "http",
  prefix: "/api"
});

// 创建WebSocket路由器
const wsRouter = NewRouter(app, {
  protocol: "ws",
  prefix: "/ws"
});

// 创建gRPC路由器
const grpcRouter = NewRouter(app, {
  protocol: "grpc",
  ext: {
    protoFile: "./proto/service.proto",
    streamConfig: {
      maxConcurrentStreams: 50,
      streamTimeout: 60000,
      backpressureThreshold: 2048
    }
  }
});
```

### gRPC 流处理

Koatty Router 支持完整的 gRPC 流处理功能，包括四种流类型的自动检测和处理：

```typescript
@Controller()
export class StreamController {
  
  // 服务器流 - 发送多个响应
  async serverStream(ctx: any) {
    for (let i = 0; i < 10; i++) {
      ctx.writeStream({ data: `Message ${i}` });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    ctx.endStream();
  }
  
  // 客户端流 - 接收多个请求
  async clientStream(ctx: any) {
    const messages = ctx.streamMessages;
    const total = messages.reduce((acc, msg) => acc + msg.value, 0);
    return { total };
  }
  
  // 双向流 - 实时交互
  async bidirectionalStream(ctx: any) {
    if (ctx.streamMessage) {
      const response = processMessage(ctx.streamMessage);
      ctx.writeStream(response);
    }
  }
  
  // 一元调用 - 标准请求响应
  async unaryCall(ctx: any) {
    return { result: "success" };
  }
}
```

**gRPC 流特性：**
- 🔄 **自动流类型检测** - 无需手动指定流类型
- 🚦 **背压控制** - 防止内存溢出和性能问题
- ⚡ **并发管理** - 限制同时活跃的流数量
- 🔗 **连接池** - 提高连接复用率
- 📦 **批处理** - 优化网络性能
- ⏱️ **超时管理** - 自动清理长时间运行的流

### 控制器装饰器

```typescript
import { Controller, Get, Post, RequestMapping } from "koatty_router";

@Controller("/user")
export class UserController {
  
  @Get("/profile")
  async getProfile(@Get("id") id: string) {
    return { id, name: "用户" };
  }
  
  @Post("/create")
  async createUser(@Post() userData: UserDTO) {
    // 自动验证和转换
    return { success: true };
  }
  
  @RequestMapping("/custom", "PUT")
  async updateUser(@PathVariable("id") id: string, @Post() data: any) {
    return { id, updated: true };
  }
}
```

## 路由器工厂模式

### 使用默认工厂

```typescript
import { RouterFactory } from "koatty_router";

const factory = RouterFactory.getInstance();

// 获取支持的协议
console.log(factory.getSupportedProtocols()); 
// ['http', 'https', 'ws', 'wss', 'grpc', 'graphql']

// 创建路由器
const router = factory.create("http", app, { prefix: "/api" });
```

### 注册自定义路由器

```typescript
import { RouterFactory, RegisterRouter } from "koatty_router";

// 方式1：直接注册
const factory = RouterFactory.getInstance();
factory.register("custom", CustomRouter);

// 方式2：使用装饰器
@RegisterRouter("mqtt")
class MqttRouter implements KoattyRouter {
  // 自定义路由器实现
}
```

### 工厂构建器

```typescript
import { RouterFactoryBuilder } from "koatty_router";

const customFactory = new RouterFactoryBuilder()
  .addRouter("custom", CustomRouter)
  .excludeDefault("graphql")
  .build();
```

## 中间件管理

`MiddlewareManager` 专注于路由级别的中间件注册、组合和条件执行，全局中间件由 Koatty 框架层面管理。

### 中间件注册方式

#### 1. 装饰器自动注册

通过路由装饰器声明的中间件类会自动注册到 `MiddlewareManager`：

```typescript
// 中间件类
class AuthMiddleware {
  async run(ctx: KoattyContext, next: KoattyNext) {
    // 认证逻辑
    console.log('Auth middleware executed');
    await next();
  }
}

// 控制器中使用
@Controller()
export class UserController {
  @RequestMapping("/users", "GET", [AuthMiddleware])
  async getUsers() {
    return { users: [] };
  }
}
```

#### 2. 手动注册

```typescript
const middlewareManager = MiddlewareManager.getInstance();

// 注册路由级别中间件
middlewareManager.register({
  name: 'paramValidation',
  middleware: async (ctx, next) => {
    // 参数验证逻辑
    await next();
  },
  priority: 100,
  metadata: { type: 'route' }
});
```

### 中间件组合

```typescript
// 组合多个路由中间件
const composedMiddleware = middlewareManager.compose([
  'routeAuth',
  'paramValidation',
  'routeCache'
], {
  route: '/api/users',
  method: 'GET'
});
```

### 条件中间件

```typescript
// 注册基于条件的中间件
middlewareManager.register({
  name: 'routeCache',
  middleware: async (ctx, next) => {
    // 缓存逻辑
    await next();
  },
  conditions: [
    { type: 'method', value: 'GET' }
  ]
});
```

**注意**: `MiddlewareManager` 主要用于路由级别的中间件管理，全局中间件（如错误处理、请求日志、CORS）应通过 Koatty 框架的中间件系统管理。

## 参数验证和注入

### 参数装饰器

```typescript
import { Get, Post, Header, PathVariable, File } from "koatty_router";

@Controller("/api")
export class ApiController {
  
  @Get("/user/:id")
  async getUser(
    @PathVariable("id") id: string,
    @Get("include") include?: string,
    @Header("authorization") token?: string
  ) {
    return { id, include, token };
  }
  
  @Post("/upload")
  async upload(
    @File("file") file: any,
    @Post() metadata: any
  ) {
    return { filename: file.name, metadata };
  }
}
```

### DTO验证

```typescript
import { IsString, IsNumber, IsEmail } from "koatty_validation";

export class UserDTO {
  @IsString()
  name: string;
  
  @IsNumber()
  age: number;
  
  @IsEmail()
  email: string;
}

@Controller("/user")
export class UserController {
  @Post("/create")
  @Validated()
  async create(@Post() user: UserDTO) {
    // user已自动验证和转换
    return user;
  }
}
```

## 协议特定功能

### WebSocket路由

```typescript
const wsRouter = NewRouter(app, {
  protocol: "ws",
  prefix: "/ws",
  maxFrameSize: 1024 * 1024, // 1MB
  heartbeatInterval: 15000    // 15秒
});
```

### gRPC路由

```typescript
const grpcRouter = NewRouter(app, {
  protocol: "grpc",
  ext: {
    protoFile: "./proto/service.proto",
    poolSize: 10,
    batchSize: 100
  }
});
```

### GraphQL路由

```typescript
const graphqlRouter = NewRouter(app, {
  protocol: "graphql",
  ext: {
    schemaFile: "./schema/schema.graphql",
    playground: true
  }
});
```

## 性能监控

### 中间件统计

```typescript
const manager = MiddlewareManager.getInstance();

// 获取执行统计
const stats = manager.getStats();
console.log(stats);
// {
//   "routeAuth": { executions: 100, totalTime: 1500, errors: 2, avgTime: 15 },
//   "paramValidation": { executions: 150, totalTime: 300, errors: 0, avgTime: 2 }
// }

// 获取特定中间件统计
const authStats = manager.getStats("routeAuth");

// 清除统计
manager.clearStats();
```

### 路由器信息

```typescript
const factory = RouterFactory.getInstance();

// 检查协议支持
console.log(factory.isSupported("grpc")); // true

// 获取路由器类
const RouterClass = factory.getRouterClass("http");
```

## 配置选项

### RouterOptions

```typescript
interface RouterOptions {
  prefix: string;              // 路由前缀
  protocol?: string;           // 协议类型
  methods?: string[];          // 支持的HTTP方法
  sensitive?: boolean;         // 大小写敏感
  strict?: boolean;           // 严格匹配
  payload?: PayloadOptions;    // 载荷解析选项
  ext?: Record<string, any>;   // 扩展配置
}
```

### PayloadOptions

```typescript
interface PayloadOptions {
  extTypes?: Record<string, string[]>;  // 支持的内容类型
  limit?: string;                       // 大小限制
  encoding?: string;                    // 编码格式
  multiples?: boolean;                  // 多文件支持
  keepExtensions?: boolean;             // 保留文件扩展名
}
```

## 最佳实践

### 1. 中间件分层管理

```typescript
// 框架级别的全局中间件（由Koatty框架管理）
// - 错误处理 (errorHandler)
// - 请求日志 (requestLogger) 
// - CORS处理 (cors)
// - 安全头设置 (security)

// 路由级别的中间件（由MiddlewareManager管理）
const routeMiddlewareOrder = [
  "paramValidation", // 100 - 参数验证
  "routeAuth",       // 90  - 路由认证
  "routeCache",      // 80  - 路由缓存
  "rateLimit"        // 70  - 限流控制
];
```

### 2. 路由器选择

```typescript
// 根据需求选择合适的协议
const protocolMap = {
  "web-api": "http",
  "real-time": "ws", 
  "microservice": "grpc",
  "query-api": "graphql"
};
```

### 3. 中间件职责分离

```typescript
// 框架级别 - 全局处理
app.use(errorHandler);    // 全局错误处理
app.use(requestLogger);   // 全局请求日志
app.use(corsHandler);     // 全局CORS处理

// 路由级别 - 特定路由处理
const manager = MiddlewareManager.getInstance();
manager.register({
  name: "apiAuth",
  middleware: authHandler,
  conditions: [
    { type: "path", value: "/api/*", operator: "matches" }
  ]
});
```

## API文档

详细的API文档请参考：[API Documentation](./docs/api.md)

## 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解版本更新信息。

## 许可证

[BSD-3-Clause](./LICENSE)
