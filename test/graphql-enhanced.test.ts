/*
 * @Description: GraphQL路由器增强测试
 * @Usage: 测试GraphQL路由器的各种功能和边界情况
 * @Author: richen
 * @Date: 2025-01-20 10:00:00
 */

// Mock modules first
jest.mock('fs', () => ({
  readFileSync: jest.fn()
}));

jest.mock('koatty_container', () => ({
  IOC: {
    getClass: jest.fn(),
    getInsByClass: jest.fn()
  }
}));

jest.mock('koatty_lib', () => ({
  Helper: {
    isEmpty: jest.fn()
  }
}));

jest.mock('koatty_logger', () => ({
  DefaultLogger: { 
    Debug: jest.fn(), 
    Warn: jest.fn(), 
    Error: jest.fn() 
  }
}));

jest.mock('koatty_graphql', () => ({
  buildSchema: jest.fn()
}));

jest.mock('koa-graphql', () => ({
  graphqlHTTP: jest.fn()
}));

jest.mock('../src/payload/payload', () => ({
  payload: jest.fn(() => () => {})
}));

jest.mock('../src/utils/inject', () => ({
  injectParamMetaData: jest.fn(),
  injectRouter: jest.fn()
}));

jest.mock('../src/utils/handler', () => ({
  Handler: jest.fn()
}));

jest.mock('../src/router/types', () => ({
  getProtocolConfig: jest.fn()
}));

import fs from 'fs';
import { GraphQLRouter } from '../src/router/graphql';
import { IOC } from 'koatty_container';
import { Helper } from 'koatty_lib';
import { DefaultLogger as Logger } from 'koatty_logger';
import { buildSchema } from 'koatty_graphql';
import { graphqlHTTP } from 'koa-graphql';
import { payload } from '../src/payload/payload';
import { injectParamMetaData, injectRouter } from '../src/utils/inject';
import { Handler } from '../src/utils/handler';
import { getProtocolConfig } from '../src/router/types';
import { EventEmitter } from 'events';

// Mock classes
class MockKoatty extends EventEmitter {
  use = jest.fn();
  callback = jest.fn();
}

class MockKoaRouter {
  all = jest.fn();
  routes = jest.fn(() => () => {});
  allowedMethods = jest.fn(() => () => {});
}

// Mock KoaRouter
jest.mock('@koa/router', () => {
  return jest.fn().mockImplementation(() => new MockKoaRouter());
});

describe('GraphQLRouter 增强测试', () => {
  let app: MockKoatty;

  beforeEach(() => {
    app = new MockKoatty() as any;
    jest.clearAllMocks();
  });

  describe('构造函数测试', () => {
    test('应该使用默认选项创建GraphQL路由器', () => {
      (getProtocolConfig as jest.Mock).mockReturnValue({ schemaFile: 'test.graphql' });
      (payload as jest.Mock).mockReturnValue(() => {});

      const router = new GraphQLRouter(app as any);

      expect(router.protocol).toBe('graphql');
      expect(router.options.protocol).toBe('graphql');
      expect(router.options.prefix).toBe('');
      expect(router.options.schemaFile).toBe('test.graphql');
      expect(app.use).toHaveBeenCalled();
      expect(payload).toHaveBeenCalled();
    });

    test('应该使用自定义选项创建GraphQL路由器', () => {
      const customOptions = {
        protocol: 'graphql',
        prefix: '/api',
        ext: { schemaFile: 'custom.graphql' }
      };
      
      (getProtocolConfig as jest.Mock).mockReturnValue({ schemaFile: 'custom.graphql' });
      (payload as jest.Mock).mockReturnValue(() => {});

      const router = new GraphQLRouter(app as any, customOptions);

      expect(router.protocol).toBe('graphql');
      expect(router.options.prefix).toBe('/api');
      expect(router.options.schemaFile).toBe('custom.graphql');
      expect(getProtocolConfig).toHaveBeenCalledWith('graphql', { schemaFile: 'custom.graphql' });
    });
  });

  describe('SetRouter方法测试', () => {
    let router: GraphQLRouter;

    beforeEach(() => {
      (getProtocolConfig as jest.Mock).mockReturnValue({ schemaFile: 'test.graphql' });
      (payload as jest.Mock).mockReturnValue(() => {});
      router = new GraphQLRouter(app as any);
    });

    test('应该正确设置GraphQL路由', () => {
      const mockSchema = { type: 'schema' };
      const mockImplementation = { hello: () => 'world' };
      const mockGraphqlMiddleware = jest.fn();
      
      (Helper.isEmpty as jest.Mock).mockReturnValue(false);
      (graphqlHTTP as jest.Mock).mockReturnValue(mockGraphqlMiddleware);

      const routerImpl = {
        schema: mockSchema,
        implementation: mockImplementation
      };

      router.SetRouter('/graphql', routerImpl);

      expect(Helper.isEmpty).toHaveBeenCalledWith(mockImplementation);
      expect(graphqlHTTP).toHaveBeenCalledWith({
        schema: mockSchema,
        rootValue: mockImplementation,
        graphiql: {
          headerEditorEnabled: true
        }
      });
      expect(router.router.all).toHaveBeenCalledWith('/graphql', mockGraphqlMiddleware);
    });

    test('应该忽略空的实现', () => {
      (Helper.isEmpty as jest.Mock).mockReturnValue(true);

      const routerImpl = {
        schema: {},
        implementation: null
      };

      router.SetRouter('/graphql', routerImpl);

      expect(Helper.isEmpty).toHaveBeenCalled();
      expect(graphqlHTTP).not.toHaveBeenCalled();
      expect(router.router.all).not.toHaveBeenCalled();
    });
  });

  describe('ListRouter方法测试', () => {
    test('应该返回路由映射', () => {
      (getProtocolConfig as jest.Mock).mockReturnValue({ schemaFile: 'test.graphql' });
      (payload as jest.Mock).mockReturnValue(() => {});
      
      const router = new GraphQLRouter(app as any);
      const routerMap = router.ListRouter();

      expect(routerMap).toBeInstanceOf(Map);
      expect(routerMap.size).toBe(0);
    });
  });

  describe('LoadRouter方法测试', () => {
    let router: GraphQLRouter;

    beforeEach(() => {
      (getProtocolConfig as jest.Mock).mockReturnValue({ schemaFile: 'test/test.graphql' });
      (payload as jest.Mock).mockReturnValue(() => {});
      router = new GraphQLRouter(app as any);
    });

    test('应该成功加载路由和schema', async () => {
      const schemaContent = 'type Query { hello: String }';
      const mockSchema = { type: 'schema' };
      const mockController = class TestController {};
      const mockRouters = {
        hello: {
          method: 'hello',
          path: '/hello',
          requestMethod: 'POST',
          ctlPath: '/graphql'
        }
      };
      const mockParams = {
        hello: []
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(schemaContent);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema);
      (IOC.getClass as jest.Mock).mockReturnValue(mockController);
      (injectRouter as jest.Mock).mockReturnValue(mockRouters);
      (injectParamMetaData as jest.Mock).mockReturnValue(mockParams);
      (IOC.getInsByClass as jest.Mock).mockReturnValue({});
      (Handler as jest.Mock).mockResolvedValue('result');
      (Helper.isEmpty as jest.Mock).mockReturnValue(false);
      (graphqlHTTP as jest.Mock).mockReturnValue(jest.fn());

      const controllerList = ['TestController'];

      await router.LoadRouter(app as any, controllerList);

      expect(fs.readFileSync).toHaveBeenCalledWith('test/test.graphql', 'utf-8');
      expect(buildSchema).toHaveBeenCalledWith(schemaContent);
      expect(IOC.getClass).toHaveBeenCalledWith('TestController', 'CONTROLLER');
      expect(injectRouter).toHaveBeenCalledWith(app, mockController, 'graphql');
      expect(injectParamMetaData).toHaveBeenCalledWith(app, mockController, undefined);
      expect(Logger.Debug).toHaveBeenCalledWith('Register request mapping: TestController.hello');
      expect(app.use).toHaveBeenCalled();
    });

    test('应该处理文件读取错误', async () => {
      const error = new Error('File not found');
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const controllerList = ['TestController'];

      await router.LoadRouter(app as any, controllerList);

      expect(Logger.Error).toHaveBeenCalledWith(error);
    });

    test('应该跳过没有路由的控制器', async () => {
      const schemaContent = 'type Query { hello: String }';
      const mockSchema = { type: 'schema' };
      const mockController = class TestController {};

      (fs.readFileSync as jest.Mock).mockReturnValue(schemaContent);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema);
      (IOC.getClass as jest.Mock).mockReturnValue(mockController);
      (injectRouter as jest.Mock).mockReturnValue(null); // 没有路由

      const controllerList = ['TestController'];

      await router.LoadRouter(app as any, controllerList);

      expect(injectParamMetaData).not.toHaveBeenCalled();
      expect(Logger.Debug).not.toHaveBeenCalled();
    });
  });
}); 