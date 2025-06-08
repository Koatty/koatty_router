/*
 * @Description: Comprehensive tests for inject.ts
 * @Usage: Test suite for dependency injection functionality
 * @Author: test
 * @Date: 2025-06-09
 */

// Set environment before imports
process.env.KOATTY_ENV = 'test';
process.env.NODE_ENV = 'test';

import 'reflect-metadata';
import { injectRouter, injectParamMetaData, injectParam, getPublicMethods } from '../src/utils/inject';

// Mock dependencies before importing modules that use them
jest.mock('koatty_container', () => ({
  IOC: {
    getIdentifier: jest.fn(),
    getPropertyData: jest.fn(),
    attachPropertyData: jest.fn(),
    getType: jest.fn(),
    getClass: jest.fn(),
  },
  recursiveGetMetadata: jest.fn(),
  getOriginMetadata: jest.fn(),
  TAGGED_PARAM: Symbol('TAGGED_PARAM')
}));

jest.mock('koatty_lib', () => ({
  Helper: {
    toString: jest.fn()
  }
}));

jest.mock('koatty_logger', () => ({
  DefaultLogger: {
    Debug: jest.fn(),
    Info: jest.fn(),
    Warn: jest.fn(),
    Error: jest.fn()
  }
}));

jest.mock('ts-morph', () => ({
  Project: jest.fn()
}));

jest.mock('../src/middleware/manager', () => ({
  RouterMiddlewareManager: {
    getInstance: jest.fn()
  }
}));

jest.mock('koatty_validation', () => ({
  PARAM_RULE_KEY: Symbol('PARAM_RULE_KEY'),
  PARAM_CHECK_KEY: Symbol('PARAM_CHECK_KEY'),
  PARAM_TYPE_KEY: Symbol('PARAM_TYPE_KEY'),
  paramterTypes: {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    object: 'object'
  }
}));

describe('inject.ts Core Functions', () => {
  let mockApp: any;
  let mockTarget: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup basic mocks
    const { IOC, recursiveGetMetadata, getOriginMetadata } = require('koatty_container');
    const { Helper } = require('koatty_lib');
    const { RouterMiddlewareManager } = require('../src/middleware/manager');

    // Mock IOC
    IOC.getIdentifier.mockReturnValue('TestController');
    IOC.getPropertyData.mockReturnValue({});
    IOC.attachPropertyData.mockReturnValue(undefined);
    IOC.getType.mockReturnValue('CONTROLLER');
    IOC.getClass.mockReturnValue(null);

    // Mock Helper
    Helper.toString.mockReturnValue('testMethod');

    // Mock RouterMiddlewareManager
    const mockMiddlewareManager = {
      getMiddleware: jest.fn().mockReturnValue(null),
      register: jest.fn(),
      _instanceId: 'test-id'
    };
    RouterMiddlewareManager.getInstance.mockReturnValue(mockMiddlewareManager);

    // Mock metadata functions
    recursiveGetMetadata.mockReturnValue({});
    getOriginMetadata.mockReturnValue(new Map());

    mockApp = {
      appDebug: false,
      getMetaData: jest.fn().mockReturnValue([])
    };

    mockTarget = {
      name: 'TestController',
      prototype: {}
    };

    process.env.APP_PATH = '/test/app';
  });

  afterEach(() => {
    delete process.env.APP_PATH;
  });

  describe('injectRouter', () => {
    it('should return null for non-matching protocol', () => {
      const { IOC } = require('koatty_container');
      IOC.getPropertyData.mockReturnValue({
        path: '/test',
        protocol: 'ws'
      });

      const result = injectRouter(mockApp, mockTarget, 'http');
      expect(result).toBeNull();
    });

    it('should process basic router metadata', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      
      IOC.getPropertyData.mockReturnValue({
        path: '/api',
        protocol: 'http'
      });

      recursiveGetMetadata.mockReturnValue({
        'testMethod': [{
          path: '/test',
          requestMethod: 'GET',
          middleware: []
        }]
      });

      const result = injectRouter(mockApp, mockTarget, 'http');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('/api/test||GET');
    });

    it('should normalize controller paths', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      
      IOC.getPropertyData.mockReturnValue({
        path: 'api', // without leading slash
        protocol: 'http'
      });

      recursiveGetMetadata.mockReturnValue({
        'testMethod': [{
          path: '/test',
          requestMethod: 'GET',
          middleware: []
        }]
      });

      const result = injectRouter(mockApp, mockTarget, 'http');

      expect(result).toHaveProperty('/api/test||GET');
    });

    it('should handle empty path', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      
      IOC.getPropertyData.mockReturnValue({
        path: '',
        protocol: 'http'
      });

      recursiveGetMetadata.mockReturnValue({
        'testMethod': [{
          path: '/test',
          requestMethod: 'GET',
          middleware: []
        }]
      });

      const result = injectRouter(mockApp, mockTarget, 'http');

      expect(result).toHaveProperty('/test||GET');
    });

    it('should process middleware classes', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      const { RouterMiddlewareManager } = require('../src/middleware/manager');
      
      IOC.getPropertyData.mockReturnValue({
        path: '/api',
        protocol: 'http'
      });

             function TestMiddleware() {}
       TestMiddleware.prototype.run = async function(ctx: any, next: any) {
         await next();
       };

      recursiveGetMetadata.mockReturnValue({
        'testMethod': [{
          path: '/test',
          requestMethod: 'GET',
          middleware: [TestMiddleware]
        }]
      });

      const mockMiddlewareManager = RouterMiddlewareManager.getInstance();
      mockMiddlewareManager.getMiddleware.mockReturnValue(null);

      const result = injectRouter(mockApp, mockTarget, 'http');

      expect(mockMiddlewareManager.register).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('injectParamMetaData', () => {
    it('should process parameter metadata', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      
      const mockParams = {
        'testMethod': [{
          fn: jest.fn(),
          name: 'param1',
          index: 0,
          type: 'string',
          isDto: false
        }]
      };

      recursiveGetMetadata
        .mockReturnValueOnce(mockParams)
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      const result = injectParamMetaData(mockApp, mockTarget);

      expect(result).toBeDefined();
      expect(result.testMethod).toHaveLength(1);
      expect(result.testMethod[0].type).toBe('string');
    });

    it('should handle DTO parameters', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      
      const mockParams = {
        'testMethod': [{
          fn: jest.fn(),
          name: 'dto',
          index: 0,
          type: 'TestDto',
          isDto: true
        }]
      };

      const mockDtoClass = function TestDto() {};
      IOC.getClass.mockReturnValue(mockDtoClass);

      recursiveGetMetadata
        .mockReturnValueOnce(mockParams)
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      const result = injectParamMetaData(mockApp, mockTarget);

      expect(result.testMethod[0].clazz).toBe(mockDtoClass);
    });

    it('should throw error for unregistered DTO', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      
      const mockParams = {
        'testMethod': [{
          fn: jest.fn(),
          name: 'dto',
          index: 0,
          type: 'UnknownDto',
          isDto: true
        }]
      };

      IOC.getClass.mockReturnValue(null);

      recursiveGetMetadata
        .mockReturnValueOnce(mockParams)
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      expect(() => {
        injectParamMetaData(mockApp, mockTarget);
      }).toThrow('Failed to obtain the class UnknownDto');
    });

    it('should handle validation metadata', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      
      const mockParams = {
        'testMethod': [{
          fn: jest.fn(),
          name: 'param1',
          index: 0,
          type: 'string',
          isDto: false
        }]
      };

      const mockValidation = {
        'testMethod': [{
          index: 0,
          name: 'param1',
          rule: 'required',
          options: { message: 'Required field' }
        }]
      };

      recursiveGetMetadata
        .mockReturnValueOnce(mockParams)
        .mockReturnValueOnce(mockValidation)
        .mockReturnValueOnce({});

      const result = injectParamMetaData(mockApp, mockTarget);

      expect(result.testMethod[0].validRule).toBe('required');
      expect(result.testMethod[0].validOpt).toEqual({ message: 'Required field' });
    });

         it('should apply payload options', () => {
       const { recursiveGetMetadata } = require('koatty_container');
       
       const mockParams = {
         'testMethod': [{
           fn: jest.fn(),
           name: 'param1',
           index: 0,
           type: 'string',
           isDto: false
         }]
       };

       recursiveGetMetadata
         .mockReturnValueOnce(mockParams)
         .mockReturnValueOnce({})
         .mockReturnValueOnce({});

       const payloadOptions = { 
         encoding: 'utf8' as any, 
         limit: '1mb',
         extTypes: {},
         multiples: false,
         keepExtensions: false
       };
       const result = injectParamMetaData(mockApp, mockTarget, payloadOptions);

       expect(result.testMethod[0].options).toBe(payloadOptions);
     });
  });

  describe('injectParam', () => {
    it('should create parameter decorator', () => {
      const { IOC } = require('koatty_container');
      
      // Mock Reflect.getMetadata
      const originalGetMetadata = Reflect.getMetadata;
      Reflect.getMetadata = jest.fn().mockReturnValue([String]);

      const mockFn = jest.fn();
      const decorator = injectParam(mockFn, 'TestParam');
      
      const result = decorator(mockTarget, 'testMethod', 0);

      expect(IOC.attachPropertyData).toHaveBeenCalled();
      expect(result).toBe(0);

      // Restore
      Reflect.getMetadata = originalGetMetadata;
    });

    it('should reject non-controller usage', () => {
      const { IOC } = require('koatty_container');
      IOC.getType.mockReturnValue('SERVICE');

      const decorator = injectParam(jest.fn(), 'TestParam');

      expect(() => {
        decorator(mockTarget, 'testMethod', 0);
      }).toThrow('TestParam decorator is only used in controllers class.');
    });

    it('should handle DTO parameter types', () => {
      const { IOC } = require('koatty_container');
      const { Helper } = require('koatty_lib');
      
      // Mock Reflect.getMetadata for custom type
      const originalGetMetadata = Reflect.getMetadata;
      Reflect.getMetadata = jest.fn().mockReturnValue([{ name: 'CustomDto' }]);

      Helper.toString.mockReturnValue('CustomDto');
      IOC.getIdentifier.mockReturnValue('CustomDto');

      const mockFn = jest.fn();
      const decorator = injectParam(mockFn, 'TestParam');
      
      decorator(mockTarget, 'testMethod', 0);

      expect(IOC.attachPropertyData).toHaveBeenCalledWith(
        expect.any(Symbol),
        expect.objectContaining({
          type: 'CustomDto',
          isDto: true
        }),
        mockTarget,
        'testMethod'
      );

      // Restore
      Reflect.getMetadata = originalGetMetadata;
    });
  });

  describe('getPublicMethods', () => {
    it('should return public method names', () => {
      const { Project } = require('ts-morph');
      
      const mockMethod = {
        getName: jest.fn().mockReturnValue('publicMethod'),
        getModifiers: jest.fn().mockReturnValue([])
      };

      const mockClass = {
        getMethods: jest.fn().mockReturnValue([mockMethod])
      };

      const mockSourceFile = {
        getClass: jest.fn().mockReturnValue(mockClass)
      };

      const mockProject = {
        addSourceFileAtPath: jest.fn().mockReturnValue(mockSourceFile)
      };

      Project.mockImplementation(() => mockProject);

      const result = getPublicMethods('/test/path.ts', 'TestClass');

      expect(result).toEqual(['publicMethod']);
    });

    it('should exclude private methods', () => {
      const { Project } = require('ts-morph');
      
      const publicMethod = {
        getName: () => 'publicMethod',
        getModifiers: () => []
      };

      const privateMethod = {
        getName: () => 'privateMethod',
        getModifiers: () => [{ getText: () => 'private' }]
      };

      const mockClass = {
        getMethods: () => [publicMethod, privateMethod]
      };

      const mockSourceFile = {
        getClass: () => mockClass
      };

      const mockProject = {
        addSourceFileAtPath: () => mockSourceFile
      };

      Project.mockImplementation(() => mockProject);

      const result = getPublicMethods('/test/path.ts', 'TestClass');

      expect(result).toEqual(['publicMethod']);
    });

    it('should handle missing class', () => {
      const { Project } = require('ts-morph');
      
      const mockSourceFile = {
        getClass: jest.fn().mockReturnValue(null)
      };

      const mockProject = {
        addSourceFileAtPath: jest.fn().mockReturnValue(mockSourceFile)
      };

      Project.mockImplementation(() => mockProject);

      const result = getPublicMethods('/test/path.ts', 'NonExistent');

      expect(result).toEqual([]);
    });

    it('should handle protected methods', () => {
      const { Project } = require('ts-morph');
      
      const publicMethod = {
        getName: () => 'publicMethod',
        getModifiers: () => []
      };

      const protectedMethod = {
        getName: () => 'protectedMethod',
        getModifiers: () => [{ getText: () => 'protected' }]
      };

      const mockClass = {
        getMethods: () => [publicMethod, protectedMethod]
      };

      const mockSourceFile = {
        getClass: () => mockClass
      };

      const mockProject = {
        addSourceFileAtPath: () => mockSourceFile
      };

      Project.mockImplementation(() => mockProject);

      const result = getPublicMethods('/test/path.ts', 'TestClass');

      expect(result).toEqual(['publicMethod']);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty router metadata', () => {
      const { IOC, recursiveGetMetadata } = require('koatty_container');
      
      IOC.getPropertyData.mockReturnValue({
        path: '/api',
        protocol: 'http'
      });

      recursiveGetMetadata.mockReturnValue({});

      const result = injectRouter(mockApp, mockTarget, 'http');

      expect(result).toEqual({});
    });

    it('should handle parameter sorting by index', () => {
      const { recursiveGetMetadata } = require('koatty_container');
      
      const mockParams = {
        'testMethod': [
          {
            fn: jest.fn(),
            name: 'param2',
            index: 2,
            type: 'string',
            isDto: false
          },
          {
            fn: jest.fn(),
            name: 'param0',
            index: 0,
            type: 'string',
            isDto: false
          },
          {
            fn: jest.fn(),
            name: 'param1',
            index: 1,
            type: 'string',
            isDto: false
          }
        ]
      };

      recursiveGetMetadata
        .mockReturnValueOnce(mockParams)
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      const result = injectParamMetaData(mockApp, mockTarget);

      expect(result.testMethod[0].name).toBe('param0');
      expect(result.testMethod[1].name).toBe('param1');
      expect(result.testMethod[2].name).toBe('param2');
    });

    it('should handle type conversion for non-DTO parameters', () => {
      const { recursiveGetMetadata } = require('koatty_container');
      
      const mockParams = {
        'testMethod': [{
          fn: jest.fn(),
          name: 'param1',
          index: 0,
          type: 'STRING', // uppercase
          isDto: false
        }]
      };

      recursiveGetMetadata
        .mockReturnValueOnce(mockParams)
        .mockReturnValueOnce({})
        .mockReturnValueOnce({});

      const result = injectParamMetaData(mockApp, mockTarget);

      expect(result.testMethod[0].type).toBe('string'); // should be lowercase
    });
  });
}); 