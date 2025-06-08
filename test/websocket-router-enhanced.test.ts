/*
 * @Description: Enhanced tests for WebSocket router
 * @Usage: Test suite for WebSocket router functionality
 * @Author: test
 * @Date: 2025-06-09
 */

// Set environment before imports
process.env.KOATTY_ENV = 'test';
process.env.NODE_ENV = 'test';

import 'reflect-metadata';

// Mock dependencies
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

import { WebsocketRouter } from '../src/router/ws';

describe('WebSocket Router Tests', () => {
  let mockApp: any;
  let wsRouter: WebsocketRouter;
  let mockWebSocket: any;
  let mockCtx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockApp = {
      use: jest.fn(),
      callback: jest.fn().mockImplementation((protocol, handler) => handler)
    };

    mockWebSocket = {
      on: jest.fn(),
      ping: jest.fn(),
      terminate: jest.fn(),
      send: jest.fn()
    };

    mockCtx = {
      socketId: 'test-socket-123',
      requestId: 'test-request-123',
      websocket: mockWebSocket,
      message: ''
    };

    // Setup mocks
    const deps = {
      injectRouter: require('../src/utils/inject').injectRouter,
      injectParamMetaData: require('../src/utils/inject').injectParamMetaData,
      Handler: require('../src/utils/handler').Handler,
      IOC: require('koatty_container').IOC
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

    wsRouter = new WebsocketRouter(mockApp, {
      protocol: 'ws',
      prefix: '/ws',
      ext: {
        maxFrameSize: 1024,
        frameTimeout: 5000,
        heartbeatInterval: 1000,
        maxConnections: 10,
        maxBufferSize: 10240,
        cleanupInterval: 30000
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    wsRouter.cleanup();
  });

  describe('Basic Functionality', () => {
    it('should get connection statistics', () => {
      const stats = wsRouter.getConnectionStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.totalBufferSize).toBe(0);
    });

    it('should enforce memory limits', () => {
      const result = (wsRouter as any).enforceMemoryLimits();
      expect(result).toBe(true);
    });

    it('should cleanup connections', () => {
      const socketId = 'test-socket';
      const connection = {
        socketId,
        buffers: [Buffer.from('test')],
        lastActivity: Date.now(),
        totalBufferSize: 4,
        frameTimeout: setTimeout(() => {}, 1000),
        heartbeatTimeout: setTimeout(() => {}, 1000)
      };

      (wsRouter as any).connections.set(socketId, connection);
      (wsRouter as any).connectionCount = 1;
      (wsRouter as any).totalBufferSize = 4;

      (wsRouter as any).cleanupConnection(socketId);

      expect((wsRouter as any).connections.has(socketId)).toBe(false);
      expect((wsRouter as any).connectionCount).toBe(0);
    });
  });

  describe('Message Handling', () => {
    it('should handle simple message', async () => {
      const ctl = class TestController {};
      const method = 'testMethod';
      
      const handlerPromise = (wsRouter as any).websocketHandler(
        mockApp, mockCtx, ctl, method, [], undefined, []
      );

      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      messageHandler(Buffer.from('test message'));

      const result = await handlerPromise;
      expect(result).toBe('test result');
    });

    it('should handle string message', async () => {
      const ctl = class TestController {};
      const handlerPromise = (wsRouter as any).websocketHandler(
        mockApp, mockCtx, ctl, 'testMethod', [], undefined, []
      );

      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      messageHandler('test string message');

      const result = await handlerPromise;
      expect(result).toBe('test result');
    });

    it('should reject oversized message', async () => {
      const ctl = class TestController {};
      const handlerPromise = (wsRouter as any).websocketHandler(
        mockApp, mockCtx, ctl, 'testMethod', [], undefined, []
      );

      const tooLargeMessage = Buffer.alloc(20480, 'a'); // 20KB > 10KB limit
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      messageHandler(tooLargeMessage);

      await expect(handlerPromise).rejects.toThrow('Message too large');
    });

    it('should handle memory limits exceeded', async () => {
      jest.spyOn(wsRouter as any, 'enforceMemoryLimits').mockReturnValue(false);

      const handlerPromise = (wsRouter as any).websocketHandler(
        mockApp, mockCtx, class {}, 'test', [], undefined, []
      );

      await expect(handlerPromise).rejects.toThrow('Memory limits exceeded');
    });
  });

  describe('Connection Events', () => {
    it('should handle websocket close', async () => {
      (wsRouter as any).websocketHandler(
        mockApp, mockCtx, class {}, 'test', [], undefined, []
      );

      const closeHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();

      expect((wsRouter as any).connections.has(mockCtx.socketId)).toBe(false);
    });

    it('should handle websocket error', async () => {
      const handlerPromise = (wsRouter as any).websocketHandler(
        mockApp, mockCtx, class {}, 'test', [], undefined, []
      );

      const errorHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'error')[1];
      errorHandler(new Error('WebSocket error'));

      await expect(handlerPromise).rejects.toThrow('WebSocket error');
    });

    it('should handle pong response', async () => {
      (wsRouter as any).websocketHandler(
        mockApp, mockCtx, class {}, 'test', [], undefined, []
      );

      const pongHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'pong')[1];
      pongHandler();

      const connection = (wsRouter as any).connections.get(mockCtx.socketId);
      expect(connection).toBeDefined();
    });
  });

  describe('Timeouts and Cleanup', () => {
    it('should handle frame timeout', async () => {
      const handlerPromise = (wsRouter as any).websocketHandler(
        mockApp, mockCtx, class {}, 'test', [], undefined, []
      );

      jest.advanceTimersByTime(6000); // > frameTimeout

      await expect(handlerPromise).rejects.toThrow('Connection timeout');
    });

    it('should handle heartbeat timeout', async () => {
      const handlerPromise = (wsRouter as any).websocketHandler(
        mockApp, mockCtx, class {}, 'test', [], undefined, []
      );

      jest.advanceTimersByTime(2000); // Trigger heartbeat checks

      await expect(handlerPromise).rejects.toThrow('Connection timeout');
    });

    it('should cleanup all resources', () => {
      const connection = {
        socketId: 'socket1',
        buffers: [],
        lastActivity: Date.now(),
        totalBufferSize: 0,
        frameTimeout: setTimeout(() => {}, 1000),
        heartbeatTimeout: setTimeout(() => {}, 1000)
      };

      (wsRouter as any).connections.set('socket1', connection);
      (wsRouter as any).connectionCount = 1;

      wsRouter.cleanup();

      expect((wsRouter as any).connections.size).toBe(0);
      expect((wsRouter as any).connectionCount).toBe(0);
    });
  });

  describe('Router Loading', () => {
    it('should load routes successfully', async () => {
      await wsRouter.LoadRouter(mockApp, ['TestController']);
      expect(mockApp.use).toHaveBeenCalled();
    });

    it('should handle missing routes', async () => {
      const { injectRouter } = require('../src/utils/inject');
      injectRouter.mockReturnValue(null);

      await wsRouter.LoadRouter(mockApp, ['TestController']);
      expect(mockApp.use).toHaveBeenCalled();
    });
  });
}); 