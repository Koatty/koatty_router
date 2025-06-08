/**
 * 路由器增强测试 - 专注于覆盖率提升
 */

import { NewRouter } from '../src/router/router';
import { getProtocolConfig, validateProtocolConfig } from '../src/router/types';
import { RouterFactory } from '../src/router/factory';

// Mock dependencies
jest.mock('../src/router/factory', () => ({
  RouterFactory: {
    getInstance: jest.fn().mockReturnValue({
      create: jest.fn().mockReturnValue({
        get: jest.fn(),
        post: jest.fn(),
        routes: jest.fn(() => jest.fn()),
        allowedMethods: jest.fn(() => jest.fn())
      })
    })
  }
}));

jest.mock('koatty_lib', () => ({
  Helper: {
    define: jest.fn()
  }
}));

describe('路由器增强测试', () => {
  const mockApp = {
    on: jest.fn(),
    use: jest.fn(),
    listen: jest.fn()
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础路由器 (NewRouter)', () => {
    test('应该创建默认HTTP路由器', () => {
      const { Helper } = require('koatty_lib');
      const mockFactory = RouterFactory.getInstance();
      
      const router = NewRouter(mockApp);

      expect(RouterFactory.getInstance).toHaveBeenCalled();
      expect(mockFactory.create).toHaveBeenCalledWith('http', mockApp, {
        protocol: 'http',
        prefix: ''
      });
      expect(Helper.define).toHaveBeenCalled();
      expect(router).toBeDefined();
    });

    test('应该创建带自定义选项的路由器', () => {
      const options = {
        protocol: 'ws',
        prefix: '/api',
        methods: ['GET', 'POST'],
        sensitive: true,
        strict: true
      };

      const mockFactory = RouterFactory.getInstance();
      NewRouter(mockApp, options);

      expect(mockFactory.create).toHaveBeenCalledWith('ws', mockApp, {
        protocol: 'ws',
        prefix: '/api',
        methods: ['GET', 'POST'],
        sensitive: true,
        strict: true
      });
    });

    test('应该处理空选项', () => {
      const mockFactory = RouterFactory.getInstance();
      
      NewRouter(mockApp, undefined);

      expect(mockFactory.create).toHaveBeenCalledWith('http', mockApp, {
        protocol: 'http',
        prefix: ''
      });
    });

    test('应该处理部分选项', () => {
      const options = {
        prefix: '/test'
      };

      const mockFactory = RouterFactory.getInstance();
      NewRouter(mockApp, options);

      expect(mockFactory.create).toHaveBeenCalledWith('http', mockApp, {
        protocol: 'http',
        prefix: '/test'
      });
    });
  });

  describe('协议配置工具 (getProtocolConfig)', () => {
    test('应该返回WebSocket配置', () => {
      const config = {
        maxFrameSize: 1024,
        heartbeatInterval: 15000
      };

      const result = getProtocolConfig('ws', config);

      expect(result).toEqual(config);
    });

    test('应该返回gRPC配置', () => {
      const config = {
        protoFile: './test.proto',
        poolSize: 10,
        streamConfig: { maxConcurrentStreams: 50 }
      };

      const result = getProtocolConfig('grpc', config);

      expect(result).toEqual(config);
    });

    test('应该返回GraphQL配置', () => {
      const config = {
        schemaFile: './schema.graphql',
        playground: true,
        introspection: false
      };

      const result = getProtocolConfig('graphql', config);

      expect(result).toEqual(config);
    });

    test('应该处理空配置', () => {
      const result = getProtocolConfig('http');

      expect(result).toEqual({});
    });

    test('应该处理HTTPS配置', () => {
      const config = { ssl: true };
      const result = getProtocolConfig('https', config);

      expect(result).toEqual(config);
    });

    test('应该处理WSS配置', () => {
      const config = { 
        maxFrameSize: 2048,
        secure: true 
      };
      const result = getProtocolConfig('wss', config);

      expect(result).toEqual(config);
    });
  });

  describe('协议配置验证 (validateProtocolConfig)', () => {
    test('应该验证有效的gRPC配置', () => {
      const config = { protoFile: './test.proto' };

      const result = validateProtocolConfig('grpc', config);

      expect(result).toBe(true);
    });

    test('应该拒绝无效的gRPC配置 - 空文件路径', () => {
      const config = { protoFile: '' };

      const result = validateProtocolConfig('grpc', config);

      expect(result).toBe(false);
    });

    test('应该拒绝无效的gRPC配置 - 缺少protoFile', () => {
      const config = { poolSize: 10 };

      const result = validateProtocolConfig('grpc', config);

      expect(result).toBe(false);
    });

    test('应该验证有效的GraphQL配置', () => {
      const config = { schemaFile: './schema.graphql' };

      const result = validateProtocolConfig('graphql', config);

      expect(result).toBe(true);
    });

    test('应该拒绝无效的GraphQL配置 - 空文件路径', () => {
      const config = { schemaFile: '' };

      const result = validateProtocolConfig('graphql', config);

      expect(result).toBe(false);
    });

    test('应该拒绝无效的GraphQL配置 - 缺少schemaFile', () => {
      const config = { playground: true };

      const result = validateProtocolConfig('graphql', config);

      expect(result).toBe(false);
    });

    test('应该接受WebSocket配置', () => {
      const config = { maxFrameSize: 1024 };

      const result = validateProtocolConfig('ws', config);

      expect(result).toBe(true);
    });

    test('应该接受空的WebSocket配置', () => {
      const result = validateProtocolConfig('wss', {});

      expect(result).toBe(true);
    });

    test('应该接受HTTP配置', () => {
      const result = validateProtocolConfig('http', {});

      expect(result).toBe(true);
    });

    test('应该接受HTTPS配置', () => {
      const result = validateProtocolConfig('https', {});

      expect(result).toBe(true);
    });

    test('应该拒绝未知协议', () => {
      const result = validateProtocolConfig('unknown', {});

      expect(result).toBe(false);
    });

    test('应该处理大小写不敏感的协议名', () => {
      const config = { protoFile: './test.proto' };

      const resultGrpc = validateProtocolConfig('GRPC', config);
      const resultGraphql = validateProtocolConfig('GRAPHQL', { schemaFile: './test.graphql' });
      const resultWs = validateProtocolConfig('WS', {});
      const resultHttp = validateProtocolConfig('HTTP', {});

      expect(resultGrpc).toBe(true);
      expect(resultGraphql).toBe(true);
      expect(resultWs).toBe(true);
      expect(resultHttp).toBe(true);
    });

    test('应该处理边界情况 - 空字符串协议', () => {
      const result = validateProtocolConfig('', {});

      expect(result).toBe(false);
    });

    test('应该处理边界情况 - null配置', () => {
      const result = validateProtocolConfig('http', null as any);

      expect(result).toBe(true); // HTTP允许空配置
    });

    test('应该处理边界情况 - undefined配置', () => {
      const result = validateProtocolConfig('ws', undefined as any);

      expect(result).toBe(true); // WebSocket允许空配置
    });
  });

  describe('协议特定配置类型测试', () => {
    test('应该正确处理复杂的gRPC配置', () => {
      const config = {
        protoFile: './complex.proto',
        poolSize: 20,
        batchSize: 50,
        streamConfig: {
          maxConcurrentStreams: 100,
          streamTimeout: 60000,
          backpressureThreshold: 4096,
          streamBufferSize: 2048,
          enableCompression: true
        },
        serverOptions: { 
          keepalive: true,
          maxMessageSize: 1024 * 1024
        },
        enableReflection: true
      };

      const result = getProtocolConfig('grpc', config);
      expect(result).toEqual(config);

      const isValid = validateProtocolConfig('grpc', config);
      expect(isValid).toBe(true);
    });

    test('应该正确处理复杂的GraphQL配置', () => {
      const config = {
        schemaFile: './complex.graphql',
        playground: true,
        introspection: true,
        debug: false,
        depthLimit: 15,
        complexityLimit: 2000,
        customScalars: {
          DateTime: Date,
          JSON: Object
        },
        middlewares: ['auth', 'validation']
      };

      const result = getProtocolConfig('graphql', config);
      expect(result).toEqual(config);

      const isValid = validateProtocolConfig('graphql', config);
      expect(isValid).toBe(true);
    });

    test('应该正确处理复杂的WebSocket配置', () => {
      const config = {
        maxFrameSize: 2 * 1024 * 1024,
        frameTimeout: 45000,
        heartbeatInterval: 10000,
        heartbeatTimeout: 20000,
        maxConnections: 5000,
        maxBufferSize: 50 * 1024 * 1024,
        cleanupInterval: 10 * 60 * 1000
      };

      const result = getProtocolConfig('ws', config);
      expect(result).toEqual(config);

      const isValid = validateProtocolConfig('ws', config);
      expect(isValid).toBe(true);
    });
  });
}); 