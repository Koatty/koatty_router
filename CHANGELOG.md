# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
