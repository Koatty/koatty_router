import { WebsocketRouter } from '../src/router/ws';

// Mock dependencies
jest.mock('koatty_container', () => ({
  IOC: {
    getClass: jest.fn(),
    getInsByClass: jest.fn()
  }
}));

jest.mock('koatty_logger', () => ({
  DefaultLogger: {
    Debug: jest.fn(),
    Warn: jest.fn(),
    Error: jest.fn()
  }
}));

jest.mock('../src/payload/payload', () => ({
  payload: jest.fn(() => (ctx: any, next: any) => next())
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

jest.mock('../src/router/types', () => ({
  getProtocolConfig: jest.fn((protocol: string, config: any) => ({
    maxFrameSize: 1024 * 1024,
    frameTimeout: 30000,
    heartbeatInterval: 15000,
    heartbeatTimeout: 30000,
    maxConnections: 1000,
    maxBufferSize: 10 * 1024 * 1024,
    cleanupInterval: 5 * 60 * 1000,
    ...config
  }))
}));

// Mock Koatty app
const mockApp = {
  use: jest.fn()
};

describe('WebsocketRouter Safe Tests', () => {
  let router: WebsocketRouter;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;
  let timers: NodeJS.Timeout[] = [];

  beforeAll(() => {
    // Backup original timer functions
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;
    
    // Mock setInterval to track timers
    global.setInterval = jest.fn((callback: any, delay: number) => {
      const timer = originalSetInterval(callback, delay);
      timers.push(timer);
      return timer;
    }) as any;
    
    // Mock clearInterval to track cleanup
    global.clearInterval = jest.fn((timer: any) => {
      const index = timers.indexOf(timer);
      if (index > -1) {
        timers.splice(index, 1);
      }
      originalClearInterval(timer);
    }) as any;
  });

  afterAll(() => {
    // Cleanup any remaining timers
    timers.forEach(timer => {
      originalClearInterval(timer);
    });
    timers = [];
    
    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    router = new WebsocketRouter(mockApp as any, {
      protocol: 'ws',
      prefix: '/ws'
    });
  });

  afterEach(() => {
    // Always cleanup router to prevent hanging tests
    if (router) {
      try {
        router.cleanup();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default options', () => {
      const defaultRouter = new WebsocketRouter(mockApp as any);
      
      expect(defaultRouter.protocol).toBe('ws');
      expect(defaultRouter.options.prefix).toBe('');
      expect(defaultRouter.options.maxFrameSize).toBe(1024 * 1024);
      expect(defaultRouter.options.frameTimeout).toBe(30000);
      expect(defaultRouter.options.heartbeatInterval).toBe(15000);
      expect(defaultRouter.options.heartbeatTimeout).toBe(30000);
      expect(defaultRouter.options.maxConnections).toBe(1000);
      expect(defaultRouter.options.maxBufferSize).toBe(10 * 1024 * 1024);
      expect(defaultRouter.options.cleanupInterval).toBe(5 * 60 * 1000);
      
      // Cleanup immediately
      defaultRouter.cleanup();
    });

    it('should initialize with custom options', () => {
      const customRouter = new WebsocketRouter(mockApp as any, {
        protocol: 'wss',
        prefix: '/custom',
        ext: {
          maxFrameSize: 512 * 1024,
          frameTimeout: 15000,
          heartbeatInterval: 10000,
          heartbeatTimeout: 20000,
          maxConnections: 500,
          maxBufferSize: 5 * 1024 * 1024,
          cleanupInterval: 2 * 60 * 1000
        }
      });
      
      expect(customRouter.protocol).toBe('wss');
      expect(customRouter.options.prefix).toBe('/custom');
      expect(customRouter.options.maxFrameSize).toBe(512 * 1024);
      expect(customRouter.options.frameTimeout).toBe(15000);
      expect(customRouter.options.heartbeatInterval).toBe(10000);
      expect(customRouter.options.heartbeatTimeout).toBe(20000);
      expect(customRouter.options.maxConnections).toBe(500);
      expect(customRouter.options.maxBufferSize).toBe(5 * 1024 * 1024);
      expect(customRouter.options.cleanupInterval).toBe(2 * 60 * 1000);
      
      // Cleanup immediately
      customRouter.cleanup();
    });

    it('should start cleanup timer on initialization', () => {
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000 // default cleanup interval
      );
    });
  });

  describe('Connection Management', () => {
    it('should enforce connection limits', () => {
      const routerAny = router as any;
      
      // Set connection count to max
      routerAny.connectionCount = routerAny.options.maxConnections;
      
      const result = routerAny.enforceMemoryLimits();
      expect(result).toBe(false);
    });

    it('should enforce buffer size limits', () => {
      const routerAny = router as any;
      
      // Set total buffer size to max
      routerAny.totalBufferSize = routerAny.options.maxBufferSize;
      
      const result = routerAny.enforceMemoryLimits();
      expect(result).toBe(false);
    });

    it('should pass memory limits when under threshold', () => {
      const routerAny = router as any;
      
      // Set values under limits
      routerAny.connectionCount = 10;
      routerAny.totalBufferSize = 1000;
      
      const result = routerAny.enforceMemoryLimits();
      expect(result).toBe(true);
    });

    it('should cleanup oldest connections when buffer limit exceeded', () => {
      const routerAny = router as any;
      const cleanupSpy = jest.spyOn(routerAny, 'cleanupOldestConnections');
      
      // Add some connections
      const now = Date.now();
      routerAny.connections.set('old1', {
        socketId: 'old1',
        buffers: [],
        lastActivity: now - 10000,
        totalBufferSize: 1000
      });
      
      routerAny.connectionCount = 3;
      routerAny.totalBufferSize = routerAny.options.maxBufferSize + 1000;
      
      routerAny.enforceMemoryLimits();
      
      expect(cleanupSpy).toHaveBeenCalledWith(5);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup oldest connections correctly', () => {
      const routerAny = router as any;
      const cleanupConnectionSpy = jest.spyOn(routerAny, 'cleanupConnection');
      
      const now = Date.now();
      
      // Add connections with different activity times
      routerAny.connections.set('oldest', {
        socketId: 'oldest',
        buffers: [],
        lastActivity: now - 20000,
        totalBufferSize: 1000
      });
      routerAny.connections.set('middle', {
        socketId: 'middle',
        buffers: [],
        lastActivity: now - 10000,
        totalBufferSize: 1000
      });
      routerAny.connections.set('newest', {
        socketId: 'newest',
        buffers: [],
        lastActivity: now,
        totalBufferSize: 1000
      });
      
      routerAny.cleanupOldestConnections(2);
      
      expect(cleanupConnectionSpy).toHaveBeenCalledTimes(2);
      expect(cleanupConnectionSpy).toHaveBeenCalledWith('oldest');
      expect(cleanupConnectionSpy).toHaveBeenCalledWith('middle');
    });

    it('should cleanup connection and free resources', () => {
      const routerAny = router as any;
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const mockTimeout1 = originalSetInterval(() => {}, 1000) as any;
      const mockTimeout2 = originalSetInterval(() => {}, 1000) as any;
      
      // Add connection with timeouts
      routerAny.connections.set('test-conn', {
        socketId: 'test-conn',
        buffers: [Buffer.from('test')],
        lastActivity: Date.now(),
        totalBufferSize: 4,
        frameTimeout: mockTimeout1,
        heartbeatTimeout: mockTimeout2
      });
      routerAny.connectionCount = 1;
      routerAny.totalBufferSize = 4;
      
      routerAny.cleanupConnection('test-conn');
      
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimeout1);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimeout2);
      expect(routerAny.connections.has('test-conn')).toBe(false);
      expect(routerAny.connectionCount).toBe(0);
      expect(routerAny.totalBufferSize).toBe(0);
      
      // Cleanup the mock timers
      originalClearInterval(mockTimeout1);
      originalClearInterval(mockTimeout2);
    });

    it('should handle cleanup of non-existent connection', () => {
      const routerAny = router as any;
      
      // Should not throw error
      expect(() => {
        routerAny.cleanupConnection('non-existent');
      }).not.toThrow();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should return correct connection statistics', () => {
      const routerAny = router as any;
      
      // Add some test data
      routerAny.connectionCount = 5;
      routerAny.totalBufferSize = 1000;
      
      const stats = router.getConnectionStats();
      
      expect(stats).toEqual({
        activeConnections: 5,
        totalBufferSize: 1000,
        averageBufferSize: 200, // 1000 / 5
        maxConnections: routerAny.options.maxConnections,
        maxBufferSize: routerAny.options.maxBufferSize
      });
    });

    it('should handle zero connections in statistics', () => {
      const stats = router.getConnectionStats();
      
      expect(stats.averageBufferSize).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.totalBufferSize).toBe(0);
    });
  });

  describe('Router Management', () => {
    it('should set router correctly', () => {
      const mockImpl = {
        path: '/test',
        method: 'GET' as any,
        implementation: jest.fn()
      };
      
      router.SetRouter('test-route', mockImpl);
      
      const routerMap = router.ListRouter();
      expect(routerMap.get('test-route')).toBe(mockImpl);
    });

    it('should not set router with empty path', () => {
      const mockImpl = {
        path: '',
        method: 'GET' as any,
        implementation: jest.fn()
      };
      
      router.SetRouter('test-route', mockImpl);
      
      const routerMap = router.ListRouter();
      expect(routerMap.has('test-route')).toBe(false);
    });

    it('should return router map', () => {
      const routerMap = router.ListRouter();
      expect(routerMap).toBeInstanceOf(Map);
    });
  });

  describe('LoadRouter method', () => {
    it('should handle empty controller list', async () => {
      await expect(router.LoadRouter(mockApp as any, [])).resolves.not.toThrow();
    });

    it('should handle LoadRouter with mock controllers', async () => {
      const { IOC } = require('koatty_container');
      const { injectRouter, injectParamMetaData } = require('../src/utils/inject');
      
      // Mock controller class
      const mockControllerClass = jest.fn();
      IOC.getClass.mockReturnValue(mockControllerClass);
      IOC.getInsByClass.mockReturnValue({});
      
      // Mock router injection
      injectRouter.mockReturnValue({
        testMethod: {
          method: 'testMethod',
          path: '/test',
          requestMethod: 'GET',
          middleware: []
        }
      });
      
      // Mock param injection
      injectParamMetaData.mockReturnValue({
        testMethod: {}
      });
      
      await router.LoadRouter(mockApp as any, ['TestController']);
      
      expect(IOC.getClass).toHaveBeenCalledWith('TestController', 'CONTROLLER');
      expect(injectRouter).toHaveBeenCalled();
      expect(injectParamMetaData).toHaveBeenCalled();
    });
  });

  describe('Cleanup functionality', () => {
    it('should cleanup resources properly', () => {
      const routerAny = router as any;
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      // Add some connections
      routerAny.connections.set('conn1', {
        socketId: 'conn1',
        buffers: [],
        lastActivity: Date.now(),
        totalBufferSize: 0
      });
      
      router.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(routerAny.cleanupTimer).toBeUndefined();
      expect(routerAny.connections.size).toBe(0);
    });
  });

  describe('Stale connection cleanup', () => {
    it('should cleanup stale connections', () => {
      const routerAny = router as any;
      const cleanupConnectionSpy = jest.spyOn(routerAny, 'cleanupConnection');
      
      const now = Date.now();
      const staleThreshold = routerAny.options.frameTimeout * 2;
      
      // Add stale and fresh connections
      routerAny.connections.set('stale', {
        socketId: 'stale',
        buffers: [],
        lastActivity: now - staleThreshold - 1000,
        totalBufferSize: 0
      });
      routerAny.connections.set('fresh', {
        socketId: 'fresh',
        buffers: [],
        lastActivity: now,
        totalBufferSize: 0
      });
      
      routerAny.cleanupStaleConnections();
      
      expect(cleanupConnectionSpy).toHaveBeenCalledWith('stale');
      expect(cleanupConnectionSpy).not.toHaveBeenCalledWith('fresh');
    });
  });
}); 