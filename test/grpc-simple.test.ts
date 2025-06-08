/*
 * @Description: Simple tests for grpc router
 * @Usage: Test suite for GRPC router basic functionality
 * @Author: test
 * @Date: 2025-06-09
 */

// Set environment before imports
process.env.KOATTY_ENV = 'test';
process.env.NODE_ENV = 'test';

import 'reflect-metadata';

// Mock dependencies
jest.mock('koatty_lib', () => ({
  Helper: { 
    toString: jest.fn(),
    isEmpty: jest.fn().mockReturnValue(false)
  }
}));

jest.mock('koatty_container', () => ({
  IOC: {
    getClass: jest.fn(),
    getInsByClass: jest.fn()
  }
}));

jest.mock('../src/utils/inject', () => ({
  injectRouter: jest.fn(),
  injectParamMetaData: jest.fn()
}));

jest.mock('../src/utils/handler', () => ({
  Handler: jest.fn()
}));

jest.mock('koatty_proto', () => ({
  LoadProto: jest.fn(),
  ListServices: jest.fn()
}));

jest.mock('../src/utils/path', () => ({
  parsePath: jest.fn((path: string) => path)
}));

jest.mock('koatty_logger', () => ({
  DefaultLogger: {
    Debug: jest.fn(),
    Info: jest.fn(),
    Warn: jest.fn(),
    Error: jest.fn()
  }
}));

import { GrpcRouter } from '../src/router/grpc';

describe('GRPC Router Tests', () => {
  let mockApp: any;
  let grpcRouter: GrpcRouter;

  beforeEach(() => {
    jest.clearAllMocks();

    mockApp = {
      use: jest.fn(),
      server: {
        RegisterService: jest.fn()
      },
      callback: jest.fn().mockImplementation((protocol, handler) => handler)
    };

    // Setup mocks
    const deps = {
      injectRouter: require('../src/utils/inject').injectRouter,
      injectParamMetaData: require('../src/utils/inject').injectParamMetaData,
      Handler: require('../src/utils/handler').Handler,
      IOC: require('koatty_container').IOC,
      LoadProto: require('koatty_proto').LoadProto,
      ListServices: require('koatty_proto').ListServices
    };

    deps.injectRouter.mockReturnValue({
      testMethod: { path: '/test', method: 'testMethod', middleware: [] }
    });
    deps.injectParamMetaData.mockReturnValue({ testMethod: [] });
    deps.Handler.mockResolvedValue('test result');
    deps.IOC.getClass.mockReturnValue(class TestController {});
    deps.IOC.getInsByClass.mockReturnValue({
      testMethod: jest.fn().mockResolvedValue('success')
    });

    deps.LoadProto.mockReturnValue({
      TestService: {
        TestMethod: {
          path: '/test.TestService/TestMethod',
          requestStream: false,
          responseStream: false
        }
      }
    });

    deps.ListServices.mockReturnValue([{
      name: 'TestService',
      service: {
        TestMethod: {
          path: '/test.TestService/TestMethod',
          requestStream: false,
          responseStream: false
        }
      },
      handlers: [{
        name: 'TestMethod',
        func: jest.fn()
      }]
    }]);

    grpcRouter = new GrpcRouter(mockApp, {
      protocol: 'grpc',
      prefix: '/grpc',
      ext: {
        protoFile: 'test.proto',
        poolSize: 5,
        batchSize: 10
      }
    });
  });

  describe('Basic Functionality', () => {
    it('should initialize with correct protocol', () => {
      expect(grpcRouter.protocol).toBe('grpc');
    });

    it('should list routers', () => {
      const routers = grpcRouter.ListRouter();
      expect(routers).toBeInstanceOf(Map);
    });
  });

  describe('Router Loading', () => {
    it('should load routes successfully', async () => {
      await grpcRouter.LoadRouter(mockApp, ['TestController']);
      expect(mockApp.use).toHaveBeenCalled();
    });

    it('should handle missing routes', async () => {
      const { injectRouter } = require('../src/utils/inject');
      injectRouter.mockReturnValue(null);

      await grpcRouter.LoadRouter(mockApp, ['TestController']);
      expect(mockApp.use).toHaveBeenCalled();
    });
  });

  describe('Service Registration', () => {
    it('should handle proto loading', async () => {
      const { LoadProto } = require('koatty_proto');
      LoadProto.mockReturnValue({});

      await grpcRouter.LoadRouter(mockApp, ['TestController']);
      expect(LoadProto).toHaveBeenCalled();
    });

    it('should handle proto loading errors', async () => {
      const { LoadProto } = require('koatty_proto');
      LoadProto.mockImplementation(() => {
        throw new Error('Proto loading failed');
      });

      // Should not throw, just log error
      await expect(grpcRouter.LoadRouter(mockApp, ['TestController'])).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing controllers', async () => {
      const { IOC } = require('koatty_container');
      IOC.getClass.mockReturnValue(null);

      await grpcRouter.LoadRouter(mockApp, ['NonExistentController']);
      expect(mockApp.use).toHaveBeenCalled();
    });
  });
}); 