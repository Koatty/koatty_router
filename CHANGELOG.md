# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
## [1.18.0](https://github.com/koatty/koatty_router/compare/v1.18.0-0...v1.18.0) (2025-06-08)

>>>>>>> 85c40fb (build: v1.18.0)
## [1.18.0-0](https://github.com/koatty/koatty_router/compare/v1.15.0...v1.18.0-0) (2025-06-02)


### Features

* add cache management utilities for clearing type map cache and retrieving cache statistics ([f0a7005](https://github.com/koatty/koatty_router/commit/f0a70051c6ed90154a046260f2fe7f359cfc147c))
* enhance router options with middleware support and type refinements ([77bd0fa](https://github.com/koatty/koatty_router/commit/77bd0fa405efbe91fd9bdee583c26f79a7d6b122))
* implement gRPC streaming support with automatic stream type detection, backpressure control, and concurrent management; enhance router factory with stream configuration options; update documentation and examples for gRPC streaming ([3294e0b](https://github.com/koatty/koatty_router/commit/3294e0b52295a9cbd2606ca4097ee72265d86e3a))
* implement router factory pattern with protocol registry, stream management, and enhanced WebSocket connection handling ([3ad321e](https://github.com/koatty/koatty_router/commit/3ad321ee607200616f6f285879363c225417b018))
* introduce middleware manager with centralized registration, composition, and execution tracking, along with builder pattern and decorator support ([32c9a5b](https://github.com/koatty/koatty_router/commit/32c9a5b5a852fb141216c0060dc74ce1eb5cbe9c))
* optimize middleware manager with LRU caching for path patterns, methods, and headers to prevent memory leaks, and add cache cleanup mechanism with memory usage statistics ([90a0b15](https://github.com/koatty/koatty_router/commit/90a0b1583317a4e077eaf1cc1899bb9efd498927))
* refactor middleware manager to RouterMiddlewareManager with enhanced interface and singleton pattern, update all related references and tests ([d23ed5f](https://github.com/koatty/koatty_router/commit/d23ed5f226e09a66a8cb889f1f1eefea0efae8bc))
* refactor router configuration system to use protocol-specific ext configurations, update all router implementations (HTTP/WS/GRPC/GraphQL) to use new config structure, and migrate IOC container references to new IOC interface ([2ec4b65](https://github.com/koatty/koatty_router/commit/2ec4b6584467b4b34d61026220de4afccd5ec00a))

## [1.17.0](https://github.com/koatty/koatty_router/compare/v1.16.0...v1.17.0) (2025-01-21)

### Features

* **grpc-streaming**: 实现完整的 gRPC 流处理功能 ([#grpc-streaming](https://github.com/koatty/koatty_router/commit/grpc-streaming))
  - 新增 `GrpcStreamHandler` 类，支持四种 gRPC 流类型的自动检测和处理
  - 支持服务器流（Server Streaming）、客户端流（Client Streaming）、双向流（Bidirectional Streaming）和一元调用（Unary Call）
  - 实现智能流类型检测，无需手动指定流类型
  - 新增背压控制机制，防止内存溢出和性能问题
  - 支持并发流管理，限制同时活跃的流数量
  - 实现连接池和批处理优化，提高网络性能
  - 新增超时管理，自动清理长时间运行的流
  - 提供详细的流处理统计和监控功能

* **grpc-router-enhancement**: 增强 gRPC 路由器配置 ([#grpc-enhancement](https://github.com/koatty/koatty_router/commit/grpc-enhancement))
  - 新增 `streamConfig` 配置选项，支持流处理参数自定义
  - 支持 `maxConcurrentStreams`、`streamTimeout`、`backpressureThreshold` 等配置
  - 优化 gRPC 路由器的性能和稳定性
  - 增强错误处理和日志记录功能

### Improvements

* **streaming-performance**: 优化流处理性能
  - 实现高效的流数据缓冲和批处理机制
  - 优化内存使用，减少垃圾回收压力
  - 提供流处理性能监控和调优建议

* **documentation**: 完善 gRPC 流处理文档
  - 更新 README.md，添加详细的 gRPC 流处理使用指南
  - 提供四种流类型的完整代码示例
  - 增加流处理配置选项说明和最佳实践

### Technical Details

* gRPC 流处理支持自动检测流类型，无需手动配置
* 实现了完整的背压控制机制，确保系统稳定性
* 支持流处理的并发控制和超时管理
* 提供了丰富的流处理统计和监控功能

## [1.16.0](https://github.com/koatty/koatty_router/compare/v1.15.0...v1.16.0) (2025-01-20)

### Features

* **factory-pattern**: 实现路由器工厂模式重构 ([#factory](https://github.com/koatty/koatty_router/commit/factory))
  - 新增 `RouterFactory` 单例工厂类，支持多协议路由器的统一创建和管理
  - 支持自定义路由器注册和动态协议扩展
  - 提供 `RouterFactoryBuilder` 构建器模式，支持高级配置
  - 新增 `@RegisterRouter` 装饰器，支持自动注册自定义路由器
  - 重构 `NewRouter` 函数，使用工厂模式创建路由器实例

* **middleware-manager**: 实现统一中间件管理器 ([#middleware](https://github.com/koatty/koatty_router/commit/middleware))
  - 新增 `MiddlewareManager` 单例管理器，支持中间件的注册、组合和条件执行
  - 支持基于路径、方法、请求头和自定义条件的中间件过滤
  - 提供中间件执行统计和性能监控功能
  - 新增 `MiddlewareBuilder` 流式API，简化中间件配置
  - 支持中间件分组和批量管理
  - 新增 `@RegisterMiddleware` 装饰器，支持自动注册中间件
  - 内置错误处理、请求日志和CORS中间件

* **RouterFactory**: 引入 `RouterFactory` 统一路由创建和管理
* **自定义路由注册**: 支持自定义路由注册，允许动态扩展协议支持
* **动态协议扩展**: 通过工厂模式支持新协议的动态添加
* **MiddlewareManager**: 新增 `MiddlewareManager` 用于中间件注册和执行管理
* **装饰器中间件自动注册**: 通过路由装饰器声明的中间件类自动注册到 `MiddlewareManager`
* **统一中间件处理**: `Handler` 函数统一从 `MiddlewareManager` 获取和执行中间件

### Improvements

* **architecture**: 提升代码架构和可维护性
  - 采用工厂模式和单例模式，提高代码复用性
  - 统一路由器和中间件的管理接口
  - 增强类型安全和错误处理机制
  - 优化性能监控和调试功能

* **documentation**: 完善文档和示例
  - 更新 README.md，添加详细的使用指南和最佳实践
  - 提供完整的API文档和代码示例
  - 增加配置选项说明和性能优化建议

* **代码架构**: 采用工厂模式和中间件管理器模式，提升代码可维护性
* **文档完善**: 详细的 README 和 API 文档
* **中间件兼容性**: 保持与原有装饰器中间件系统的完全兼容

### Breaking Changes

* 路由器创建方式保持向后兼容，但推荐使用新的工厂模式
* 中间件管理从分散式改为集中式管理，提供更好的控制和监控能力
* **中间件类型**: 路由元数据中的中间件从 `Function[]` 改为 `string[]`

### Technical Details

* 装饰器中间件在 `injectRouter` 阶段自动注册到 `MiddlewareManager`
* `Handler` 函数简化，统一通过 `MiddlewareManager.compose()` 处理中间件
* 保持向后兼容，支持传统中间件类的 `run` 方法调用

>>>>>>> 7daee41 (build: v1.18.0-0)
## [1.15.0](https://github.com/koatty/koatty_router/compare/v1.14.1...v1.15.0) (2025-04-25)


### Features

* add connection pooling and batch processing to gRPC router with stream handling support ([3648155](https://github.com/koatty/koatty_router/commit/3648155aa301d5724fbc2811506f87853140337e))
* add middleware support for routers with validation and composition handling ([a50b86b](https://github.com/koatty/koatty_router/commit/a50b86bc03c39a16eb142bcf41047849a5e9c73e))
* add WebSocket frame handling with heartbeat, timeout and chunked message support ([e42c055](https://github.com/koatty/koatty_router/commit/e42c05510655c785dc63b9f3b2719771734b232c))
* replace lib for improved payload parsing performance ([3fa4a77](https://github.com/koatty/koatty_router/commit/3fa4a77354492a471403dfda279ef1a75596ed2c))

### [1.14.1](https://github.com/koatty/koatty_router/compare/v1.14.0...v1.14.1) (2025-03-15)


### Bug Fixes

* update optional chaining syntax in injectParam function ([ba133f7](https://github.com/koatty/koatty_router/commit/ba133f7aad4725c47ebee553038c12c6ef79d885))

## [1.14.0](https://github.com/koatty/koatty_router/compare/v1.13.2...v1.14.0) (2025-03-15)


### Features

* enhance GraphQL router configuration and add ctlPath to RouterMetadata ([71c96a9](https://github.com/koatty/koatty_router/commit/71c96a930ca492811400f8d6e974abcc81eb2d18))

### [1.13.2](https://github.com/koatty/koatty_router/compare/v1.13.1...v1.13.2) (2025-03-15)


### Bug Fixes

* 修正 Handler 函数中缺少返回值的问题 ([3f37db5](https://github.com/koatty/koatty_router/commit/3f37db54018b4ce8022575977a5ff782794a4df2))

### [1.13.1](https://github.com/koatty/koatty_router/compare/v1.13.0...v1.13.1) (2025-03-15)


### Bug Fixes

* 统一在路由注入时传递协议选项 ([9873667](https://github.com/koatty/koatty_router/commit/9873667dcc41afada473b2a19b457926e9d20a35))

## [1.13.0](https://github.com/koatty/koatty_router/compare/v1.12.1...v1.13.0) (2025-03-15)


### Features

* 增强路由处理，基于协议过滤控制器路由 ([1c783ef](https://github.com/koatty/koatty_router/commit/1c783ef31963ef38f9bbeeb372a2fb1d018de710))

### [1.12.1](https://github.com/koatty/koatty_router/compare/v1.12.0...v1.12.1) (2025-03-13)


### Bug Fixes

*  buildSchema 参数错误 ([d7fffd6](https://github.com/koatty/koatty_router/commit/d7fffd6c3fcad286a6662ee94a2743ca6966295a))

## [1.12.0](https://github.com/koatty/koatty_router/compare/v1.11.0...v1.12.0) (2025-03-13)


### Features

* 替换 graphql 依赖为 koatty_graphql 并优化路由处理 ([2f859a2](https://github.com/koatty/koatty_router/commit/2f859a2df229c8130609ef67be6782db5ff0b05d))
* add graphql support ([20cd5d2](https://github.com/koatty/koatty_router/commit/20cd5d20bfe02c8303953ba33f7bc15aafd74c55))
* enhance GraphQL router with improved schema handling ([c502e42](https://github.com/koatty/koatty_router/commit/c502e42f695278e415a62874dc91fefc62f9d1c8))


### Bug Fixes

* new version ([0fabc62](https://github.com/koatty/koatty_router/commit/0fabc62e65bdc17458839f5d3e319dded65ec79b))

## [1.11.0](https://github.com/koatty/koatty_router/compare/v1.10.1...v1.11.0) (2025-02-26)


### Features

* Non-public methods cannot be bound to routes ([3cc5142](https://github.com/koatty/koatty_router/commit/3cc5142620e3ff5024a9993a1aecd07c9208a446))


### Bug Fixes

* ws method error ([1f75b72](https://github.com/koatty/koatty_router/commit/1f75b725d2338bf601d4a62e08edc2a9c3f7f5f2))
* ws only support get method ([a8ad00b](https://github.com/koatty/koatty_router/commit/a8ad00b67a1d92349380669da56b1ac7d7afb428))

### [1.10.1](https://github.com/koatty/koatty_router/compare/v1.10.0...v1.10.1) (2024-11-29)


### Bug Fixes

* mix router binding ([b4cfa9c](https://github.com/koatty/koatty_router/commit/b4cfa9c10dcbfb77aed4be262b84f875f61d9568))

## [1.10.0](https://github.com/koatty/koatty_router/compare/v1.10.0-0...v1.10.0) (2024-11-07)

## [1.10.0-0](https://github.com/koatty/koatty_router/compare/v1.9.2...v1.10.0-0) (2024-10-31)


### Performance

* 优化 ([50f4729](https://github.com/koatty/koatty_router/commit/50f4729e128ed57db3282e89ffe69f2d99f34e64))

### [1.9.2](https://github.com/koatty/koatty_router/compare/v1.9.1...v1.9.2) (2024-03-15)


### Bug Fixes

* controller方法执行结果错误对象拦截 ([1536793](https://github.com/koatty/koatty_router/commit/1536793e89c5af2aa2114c71eef4c155b627da01))

### [1.9.1](https://github.com/koatty/koatty_router/compare/v1.9.0...v1.9.1) (2024-03-15)


### Bug Fixes

* injectParamMetaData参数传递错误 ([c2f91c4](https://github.com/koatty/koatty_router/commit/c2f91c4d825c5ba573f56360f3113636d58a3dd3))

## [1.9.0](https://github.com/koatty/koatty_router/compare/v1.9.0-2...v1.9.0) (2024-01-16)

## [1.9.0-2](https://github.com/koatty/koatty_router/compare/v1.9.0-1...v1.9.0-2) (2024-01-15)

## [1.9.0-1](https://github.com/koatty/koatty_router/compare/v1.8.6...v1.9.0-1) (2024-01-15)

### [1.8.11-0](https://github.com/koatty/koatty_router/compare/v1.8.6...v1.8.11-0) (2024-01-15)

### [1.8.6](https://github.com/koatty/koatty_router/compare/v1.8.5...v1.8.6) (2023-02-17)


### Bug Fixes

* convert param types ([46f5e80](https://github.com/koatty/koatty_router/commit/46f5e80a6bd35d6b77e20fa36fe46971f67be0b9))

### [1.8.5](https://github.com/koatty/koatty_router/compare/v1.8.4...v1.8.5) (2023-02-17)


### Bug Fixes

* 修复dto参数类型转换 ([7fd8f64](https://github.com/koatty/koatty_router/commit/7fd8f642c8094e2f93ce1cd50bb91b56043e71d3))

### [1.8.4](https://github.com/koatty/koatty_router/compare/v1.8.3...v1.8.4) (2023-02-10)

### [1.8.3](https://github.com/koatty/koatty_router/compare/v1.8.2...v1.8.3) (2023-02-10)


### Bug Fixes

*  koa's redirect function not available ([8b5dde5](https://github.com/koatty/koatty_router/commit/8b5dde52870f5b331cb8da8881c0774875a79ef2))
* words ([06d2803](https://github.com/koatty/koatty_router/commit/06d28038a9140e509b9bd3bb083ee2503d2b0f75))

### [1.8.2](https://github.com/koatty/koatty_router/compare/v1.8.0...v1.8.2) (2023-01-13)

## [1.8.0](https://github.com/koatty/koatty_router/compare/v1.7.12...v1.8.0) (2022-11-12)


### Bug Fixes

* httpRouter与wsRouter使用了错误的加载方式 ([94d111c](https://github.com/koatty/koatty_router/commit/94d111cc321d80b3098a3abcb999ca64d0cc4f95))

### [1.7.12](https://github.com/koatty/koatty_router/compare/v1.7.10...v1.7.12) (2022-11-01)


### Bug Fixes

* ctx.body 赋值 ([2a8d8c8](https://github.com/koatty/koatty_router/commit/2a8d8c8d4e8615777f50dc4ccaf331e4f10bc66b))

### [1.7.10](https://github.com/koatty/koatty_router/compare/v1.7.9...v1.7.10) (2022-10-31)

### [1.7.9](https://github.com/koatty/koatty_router/compare/v1.7.8...v1.7.9) (2022-08-19)


### Bug Fixes

* querystring must be convert type ([1bec352](https://github.com/koatty/koatty_router/commit/1bec3528a4f29d398a3158a25bcab4824e483433))

### [1.7.8](https://github.com/koatty/koatty_router/compare/v1.7.7...v1.7.8) (2022-08-19)

### [1.7.7](https://github.com/koatty/koatty_router/compare/v1.7.6...v1.7.7) (2022-08-19)


### Bug Fixes

* 移除强制类型转换，增加类型检查 ([199fa8d](https://github.com/koatty/koatty_router/commit/199fa8d16a3a8bc271f445e8a39a7e760afa982b))

### [1.7.6](https://github.com/koatty/koatty_router/compare/v1.7.5...v1.7.6) (2022-05-27)

### [1.7.5](https://github.com/koatty/koatty_router/compare/v1.7.4...v1.7.5) (2022-03-14)

### [1.7.4](https://github.com/koatty/koatty_router/compare/v1.7.3...v1.7.4) (2022-03-14)

### [1.7.3](https://github.com/koatty/koatty_router/compare/v1.7.2...v1.7.3) (2022-03-09)

### [1.7.2](https://github.com/koatty/koatty_router/compare/v1.7.1...v1.7.2) (2022-02-25)

### [1.7.1](https://github.com/koatty/koatty_router/compare/v1.7.0...v1.7.1) (2022-02-23)

## [1.7.0](https://github.com/koatty/koatty_router/compare/v1.7.0-1...v1.7.0) (2022-02-21)

## [1.7.0-1](https://github.com/koatty/koatty_router/compare/v1.7.0-0...v1.7.0-1) (2022-02-18)

## [1.7.0-0](https://github.com/koatty/koatty_router/compare/v1.6.6...v1.7.0-0) (2022-02-18)

### [1.6.6](https://github.com/koatty/koatty_router/compare/v1.6.4...v1.6.6) (2022-02-16)

### [1.6.4](https://github.com/koatty/koatty_router/compare/v1.6.4-1...v1.6.4) (2021-12-23)

### [1.6.4-1](https://github.com/koatty/koatty_router/compare/v1.6.4-0...v1.6.4-1) (2021-12-22)

### [1.6.4-0](https://github.com/koatty/koatty_router/compare/v1.6.2...v1.6.4-0) (2021-12-21)

### [1.6.2](https://github.com/koatty/koatty_router/compare/v1.6.0...v1.6.2) (2021-12-20)

## [1.6.0](https://github.com/koatty/koatty_router/compare/v1.5.16...v1.6.0) (2021-12-19)
