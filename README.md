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

// 创建WebSocket路由器 - 协议特定参数放在 ext 中
const wsRouter = NewRouter(app, {
  protocol: "ws",
  prefix: "/ws",
  ext: {
    maxFrameSize: 1024 * 1024,    // 1MB
    heartbeatInterval: 15000,     // 15秒
    heartbeatTimeout: 30000,      // 30秒
    maxConnections: 1000,         // 最大连接数
    maxBufferSize: 10 * 1024 * 1024, // 10MB
    cleanupInterval: 5 * 60 * 1000   // 5分钟
  }
});

// 创建gRPC路由器 - 协议特定参数放在 ext 中
const grpcRouter = NewRouter(app, {
  protocol: "grpc",
  prefix: "/grpc",
  ext: {
    protoFile: "./proto/service.proto",
    poolSize: 10,
    batchSize: 100,
    streamConfig: {
      maxConcurrentStreams: 50,
      streamTimeout: 60000,
      backpressureThreshold: 2048
    }
  }
});

// 创建GraphQL路由器 - 协议特定参数放在 ext 中
const graphqlRouter = NewRouter(app, {
  protocol: "graphql",
  prefix: "/graphql",
  ext: {
    schemaFile: "./schema/schema.graphql",
    playground: true,
    introspection: true,
    debug: false
  }
});
```

### gRPC 流处理

Koatty Router 支持完整的 gRPC 流处理功能，包括四种流类型的自动检测和处理：

```typescript
@GrpcController()
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
import { Get, Post, RequestMapping } from "koatty_router";

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

`RouterMiddlewareManager` 专注于路由级别的中间件注册、组合和条件执行，支持基于路由的独立配置，避免配置冲突。全局中间件由 Koatty 框架层面管理。

### 核心特性

- 🎯 **路由级别隔离** - 每个路由的中间件实例独立配置
- 🔧 **智能实例管理** - 使用 `${middlewareName}@${route}#${method}` 格式的唯一标识
- ⚡ **预组合优化** - 注册时组合中间件，提升运行时性能
- 🔄 **异步中间件类** - 完整支持异步 `run` 方法
- 📊 **统一管理** - 支持手动注册和装饰器自动注册

### 中间件定义

中间件类必须使用 `@Middleware()` 装饰器，并实现 `run` 方法：

```typescript
import { Middleware } from "koatty_router";

@Middleware()
export class AuthMiddleware {
  async run(config: any, app: Application) {
    return async (ctx: KoattyContext, next: KoattyNext) => {
      // 认证逻辑
      console.log('Auth middleware executed');
      ctx.authChecked = true;
      await next();
    };
  }
}

@Middleware()
export class RateLimitMiddleware {
  async run(config: any, app: Application) {
    return async (ctx: KoattyContext, next: KoattyNext) => {
      // 限流逻辑
      console.log('RateLimit middleware executed');
      ctx.rateLimited = true;
      await next();
    };
  }
}
```

### 装饰器使用方式

#### 1. 控制器级别中间件

```typescript
// 控制器级别中间件会应用到所有方法
@Controller('/api', [AuthMiddleware])
export class UserController {
  
  @GetMapping('/users')
  getUsers() {
    // 执行顺序: AuthMiddleware -> getUsers
    // 实例ID: AuthMiddleware@/api/users#GET
    return 'users list';
  }
  
  @PostMapping('/admin')
  adminAction() {
    // 执行顺序: AuthMiddleware -> adminAction
    // 实例ID: AuthMiddleware@/api/admin#POST
    return 'admin action';
  }
}
```

#### 2. 方法级别中间件

```typescript
@Controller('/api')
export class UserController {
  
  @GetMapping('/users', { 
    middleware: [AuthMiddleware, RateLimitMiddleware] 
  })
  getUsers() {
    // 执行顺序: AuthMiddleware -> RateLimitMiddleware -> getUsers
    // 实例ID: 
    // - AuthMiddleware@/api/users#GET
    // - RateLimitMiddleware@/api/users#GET
    return 'users list';
  }
  
  @PostMapping('/admin', { 
    middleware: [RateLimitMiddleware] 
  })
  adminAction() {
    // 执行顺序: RateLimitMiddleware -> adminAction
    // 实例ID: RateLimitMiddleware@/api/admin#POST
    return 'admin action';
  }
}
```

#### 3. 混合使用（控制器 + 方法级别）

```typescript
@Controller('/api', [AuthMiddleware])
export class UserController {
  
  @GetMapping('/users', { 
    middleware: [RateLimitMiddleware] 
  })
  getUsers() {
    // 执行顺序: AuthMiddleware -> RateLimitMiddleware -> getUsers
    // 实例ID:
    // - AuthMiddleware@/api/users#GET
    // - RateLimitMiddleware@/api/users#GET
    return 'users list';
  }
}
```

### 手动注册和管理

#### 1. 手动注册中间件

```typescript
const middlewareManager = RouterMiddlewareManager.getInstance(app);

// 为不同路由注册同一中间件的不同配置
const authInstance1 = await middlewareManager.register({
  name: 'AuthMiddleware',
  middleware: AuthMiddleware,
  priority: 100,
  enabled: true,
  middlewareConfig: {
    route: '/api/users',
    method: 'GET'
  }
});

const authInstance2 = await middlewareManager.register({
  name: 'AuthMiddleware', 
  middleware: AuthMiddleware,
  priority: 200, // 不同优先级
  enabled: true,
  middlewareConfig: {
    route: '/api/admin',
    method: 'POST'
  }
});
```

#### 2. 通过路由获取中间件

```typescript
// 通过路由和中间件名获取特定实例
const userAuth = middlewareManager.getMiddlewareByRoute('AuthMiddleware', '/api/users', 'GET');
const adminAuth = middlewareManager.getMiddlewareByRoute('AuthMiddleware', '/api/admin', 'POST');

// 获取中间件的所有实例
const allAuthInstances = middlewareManager.getMiddlewareInstances('AuthMiddleware');
```

#### 3. 中间件组合

```typescript
// 使用实例ID组合中间件
const composedMiddleware = middlewareManager.compose([
  'AuthMiddleware@/api/users#GET',
  'RateLimitMiddleware@/api/users#GET'
], {
  route: '/api/users',
  method: 'GET'
});
```

### 条件中间件

```typescript
// 注册基于条件的中间件
await middlewareManager.register({
  name: 'CacheMiddleware',
  middleware: CacheMiddleware,
  conditions: [
    { type: 'method', value: 'GET' },
    { type: 'path', value: '/api/cache', operator: 'contains' }
  ],
  middlewareConfig: {
    route: '/api/cache',
    method: 'GET'
  }
});
```

### 实例ID格式

每个中间件实例都有唯一的标识符：

```
格式: ${middlewareName}@${route}#${method}

示例:
- AuthMiddleware@/api/users#GET
- RateLimitMiddleware@/api/admin#POST
- CacheMiddleware@/api/cache#GET
```

这种格式确保：
- 同一中间件在不同路由上有独立配置
- 避免配置冲突
- 支持精确查找和管理

**注意**: `RouterMiddlewareManager` 主要用于路由级别的中间件管理，全局中间件（如错误处理、请求日志、CORS）应通过 Koatty 框架的中间件系统管理。

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
  ext: {
    maxFrameSize: 1024 * 1024,    // 1MB - 最大分帧大小
    heartbeatInterval: 15000,     // 15秒 - 心跳检测间隔
    heartbeatTimeout: 30000,      // 30秒 - 心跳超时时间
    maxConnections: 1000,         // 最大连接数
    maxBufferSize: 10 * 1024 * 1024, // 10MB - 最大缓冲区大小
    cleanupInterval: 5 * 60 * 1000   // 5分钟 - 清理间隔
  }
});
```

### gRPC路由

```typescript
const grpcRouter = NewRouter(app, {
  protocol: "grpc",
  prefix: "/grpc",
  ext: {
    protoFile: "./proto/service.proto",  // Protocol Buffer 文件路径
    poolSize: 10,                        // 连接池大小
    batchSize: 100,                      // 批处理大小
    streamConfig: {                      // 流配置
      maxConcurrentStreams: 50,          // 最大并发流数量
      streamTimeout: 60000,              // 流超时时间
      backpressureThreshold: 2048        // 背压阈值
    }
  }
});
```

### GraphQL路由

```typescript
const graphqlRouter = NewRouter(app, {
  protocol: "graphql",
  prefix: "/graphql",
  ext: {
    schemaFile: "./schema/schema.graphql", // GraphQL Schema 文件路径
    playground: true,                      // 启用 GraphQL Playground
    introspection: true,                   // 启用内省查询
    debug: false                           // 调试模式
  }
});
```

## 路由器信息

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
  ext?: Record<string, any>;   // 协议特定扩展配置
}
```

### 协议特定扩展配置 (ext)

#### WebSocket 配置
```typescript
ext: {
  maxFrameSize?: number;        // 最大分帧大小(字节)，默认1MB
  frameTimeout?: number;        // 分帧处理超时(ms)，默认30秒
  heartbeatInterval?: number;   // 心跳检测间隔(ms)，默认15秒
  heartbeatTimeout?: number;    // 心跳超时时间(ms)，默认30秒
  maxConnections?: number;      // 最大连接数，默认1000
  maxBufferSize?: number;       // 最大缓冲区大小(字节)，默认10MB
  cleanupInterval?: number;     // 清理间隔(ms)，默认5分钟
}
```

#### gRPC 配置
```typescript
ext: {
  protoFile: string;           // Protocol Buffer 文件路径（必需）
  poolSize?: number;           // 连接池大小，默认10
  batchSize?: number;          // 批处理大小，默认10
  streamConfig?: {             // 流配置
    maxConcurrentStreams?: number;    // 最大并发流数量，默认50
    streamTimeout?: number;           // 流超时时间(ms)，默认60秒
    backpressureThreshold?: number;   // 背压阈值(字节)，默认2048
    streamBufferSize?: number;        // 流缓冲区大小，默认1024
    enableCompression?: boolean;      // 是否启用流压缩，默认false
  };
  serverOptions?: Record<string, any>; // gRPC 服务器选项
  enableReflection?: boolean;          // 是否启用反射，默认false
}
```

#### GraphQL 配置
```typescript
ext: {
  schemaFile: string;          // GraphQL Schema 文件路径（必需）
  playground?: boolean;        // 启用 GraphQL Playground，默认false
  introspection?: boolean;     // 启用内省查询，默认true
  debug?: boolean;             // 调试模式，默认false
  depthLimit?: number;         // 查询深度限制，默认10
  complexityLimit?: number;    // 查询复杂度限制，默认1000
  customScalars?: Record<string, any>; // 自定义标量类型
  middlewares?: any[];         // 中间件配置
}
```

#### HTTP/HTTPS 配置
```typescript
ext: {
  // HTTP/HTTPS 协议目前没有特定配置
  // 可以添加自定义选项
  [key: string]: any;
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

// 路由级别的中间件（由RouterMiddlewareManager管理）
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
const manager = RouterMiddlewareManager.getInstance();
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

### 中间件管理重构 🎉

#### 🚀 新特性
- **路由级别中间件隔离** - 每个路由的中间件实例独立配置，避免配置冲突
- **智能实例管理** - 使用 `${middlewareName}@${route}#${method}` 格式的唯一标识
- **预组合优化** - 注册时组合中间件，提升运行时性能
- **异步中间件类支持** - 完整支持异步 `run` 方法
- **getMiddlewareByRoute方法** - 支持通过路由和中间件名精确获取实例

#### 🛠️ 使用示例
```typescript
// 新的中间件定义方式
@Middleware()
export class AuthMiddleware {
  async run(config: any, app: Application) {
    return async (ctx: KoattyContext, next: KoattyNext) => {
      // 中间件逻辑
      await next();
    };
  }
}

// 控制器级别中间件
@Controller('/api', [AuthMiddleware])
export class UserController {
  @GetMapping('/users', { middleware: [RateLimitMiddleware] })
  getUsers() {
    return 'users';
  }
}

// 手动获取特定路由的中间件
const middleware = manager.getMiddlewareByRoute('AuthMiddleware', '/api/users', 'GET');
```

查看 [CHANGELOG.md](./CHANGELOG.md) 了解完整的版本更新信息。

## 许可证

[BSD-3-Clause](./LICENSE)
