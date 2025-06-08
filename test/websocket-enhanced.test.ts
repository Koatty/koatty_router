/*
 * @Description: WebSocket增强测试
 * @Usage: 测试WebSocket解析器和路由器的各种功能和边界情况
 * @Author: richen
 * @Date: 2025-01-20 10:00:00
 */

// Mock modules first
jest.mock('koatty_logger', () => ({
  DefaultLogger: { 
    Debug: jest.fn(),
    Warn: jest.fn(),
    Error: jest.fn() 
  }
}));

jest.mock('koatty_container', () => ({
  IOC: {
    getInsByClass: jest.fn(),
    getClass: jest.fn()
  }
}));

jest.mock('koatty_lib', () => ({
  Helper: {
    isEmpty: jest.fn()
  }
}));

jest.mock('@koa/router', () => {
  return jest.fn().mockImplementation(() => ({
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    routes: jest.fn(() => jest.fn()),
    allowedMethods: jest.fn(() => jest.fn())
  }));
});

jest.mock('../src/payload/payload', () => ({
  payload: jest.fn(() => () => {})
}));

jest.mock('../src/payload/parser/text', () => ({
  parseText: jest.fn()
}));

jest.mock('../src/utils/inject', () => ({
  injectParamMetaData: jest.fn(),
  injectRouter: jest.fn()
}));

jest.mock('../src/utils/handler', () => ({
  Handler: jest.fn()
}));

jest.mock('../src/utils/path', () => ({
  parsePath: jest.fn((path: string) => path)
}));

jest.mock('../src/router/types', () => ({
  getProtocolConfig: jest.fn()
}));

import { parseWebSocket } from '../src/payload/parser/websocket';
import { WebsocketRouter } from '../src/router/ws';
import { DefaultLogger } from 'koatty_logger';
import { parseText } from '../src/payload/parser/text';
import { Helper } from 'koatty_lib';
import { getProtocolConfig } from '../src/router/types';

describe('WebSocket增强测试', () => {
  let mockApp: any;

  beforeEach(() => {
    mockApp = {
      use: jest.fn(),
      server: {
        on: jest.fn()
      }
    };
    jest.clearAllMocks();
  });

  describe('WebSocket解析器测试', () => {
    let mockCtx: any;
    let mockOpts: any;

    beforeEach(() => {
      mockCtx = {
        req: {
          headers: { 'content-type': 'application/json' },
          body: null
        }
      };
      mockOpts = {
        limit: '1mb',
        encoding: 'utf8',
        extTypes: {},
        multiples: false,
        keepExtensions: false
      };
    });

    test('应该成功解析JSON格式的WebSocket消息', async () => {
      const jsonMessage = JSON.stringify({
        type: 'message',
        data: { user: 'john', content: 'hello world' },
        timestamp: Date.now()
      });

      (parseText as jest.Mock).mockResolvedValue(jsonMessage);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({
        body: {
          type: 'message',
          data: { user: 'john', content: 'hello world' },
          timestamp: expect.any(Number)
        }
      });
      expect(parseText).toHaveBeenCalledWith(mockCtx, mockOpts);
    });

    test('应该处理纯文本WebSocket消息', async () => {
      const textMessage = 'Hello WebSocket!';

      (parseText as jest.Mock).mockResolvedValue(textMessage);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toBe(textMessage);
    });

    test('应该处理复杂的JSON对象', async () => {
      const complexMessage = JSON.stringify({
        event: 'user_action',
        payload: {
          action: 'click',
          element: 'button',
          metadata: {
            position: { x: 100, y: 200 },
            timestamp: Date.now(),
            userAgent: 'Mozilla/5.0...'
          }
        },
        session: {
          id: 'session-123',
          user: { id: 456, name: 'John Doe' }
        }
      });

      (parseText as jest.Mock).mockResolvedValue(complexMessage);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({
        body: {
          event: 'user_action',
          payload: {
            action: 'click',
            element: 'button',
            metadata: {
              position: { x: 100, y: 200 },
              timestamp: expect.any(Number),
              userAgent: 'Mozilla/5.0...'
            }
          },
          session: {
            id: 'session-123',
            user: { id: 456, name: 'John Doe' }
          }
        }
      });
    });

    test('应该处理空字符串输入', async () => {
      (parseText as jest.Mock).mockResolvedValue('');

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({});
      expect(DefaultLogger.Error).not.toHaveBeenCalled();
    });

    test('应该处理null输入', async () => {
      (parseText as jest.Mock).mockResolvedValue(null);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({});
      expect(DefaultLogger.Error).not.toHaveBeenCalled();
    });

    test('应该处理undefined输入', async () => {
      (parseText as jest.Mock).mockResolvedValue(undefined);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({});
      expect(DefaultLogger.Error).not.toHaveBeenCalled();
    });

    test('应该处理无效的JSON格式并回退到文本', async () => {
      const invalidJson = '{ invalid json format';

      (parseText as jest.Mock).mockResolvedValue(invalidJson);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toBe(invalidJson);
      expect(DefaultLogger.Error).not.toHaveBeenCalled();
    });

    test('应该处理parseText抛出的错误', async () => {
      const error = new Error('Parse text failed');
      (parseText as jest.Mock).mockRejectedValue(error);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({});
      expect(DefaultLogger.Error).toHaveBeenCalledWith('[WebSocketParseError]', error);
    });

    test('应该处理特殊字符的文本消息', async () => {
      const specialText = '特殊字符测试: 🚀 emoji, \n换行, \t制表符, "引号", \'单引号\'';

      (parseText as jest.Mock).mockResolvedValue(specialText);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toBe(specialText);
    });

    test('应该处理数组格式的JSON消息', async () => {
      const arrayMessage = JSON.stringify([
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' },
        { id: 3, name: 'item3' }
      ]);

      (parseText as jest.Mock).mockResolvedValue(arrayMessage);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({
        body: [
          { id: 1, name: 'item1' },
          { id: 2, name: 'item2' },
          { id: 3, name: 'item3' }
        ]
      });
    });

    test('应该处理数字格式的JSON消息', async () => {
      const numberMessage = '42';

      (parseText as jest.Mock).mockResolvedValue(numberMessage);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({ body: 42 });
    });

    test('应该处理布尔格式的JSON消息', async () => {
      const boolMessage = 'true';

      (parseText as jest.Mock).mockResolvedValue(boolMessage);

      const result = await parseWebSocket(mockCtx, mockOpts);

      expect(result).toEqual({ body: true });
    });
  });

  describe('WebSocket路由器测试', () => {
    beforeEach(() => {
      (getProtocolConfig as jest.Mock).mockReturnValue({
        maxFrameSize: 1024 * 1024,
        frameTimeout: 30000,
        heartbeatInterval: 15000,
        heartbeatTimeout: 30000,
        maxConnections: 1000,
        maxBufferSize: 10 * 1024 * 1024,
        cleanupInterval: 5 * 60 * 1000
      });
    });

    test('应该使用默认配置创建WebSocket路由器', () => {
      const router = new WebsocketRouter(mockApp);

      expect(router.protocol).toBe('ws');
      expect(router.options.prefix).toBe('');
      expect(router.options.maxFrameSize).toBe(1024 * 1024);
      expect(router.options.frameTimeout).toBe(30000);
      expect(router.options.heartbeatInterval).toBe(15000);
      expect(router.options.heartbeatTimeout).toBe(30000);
      expect(router.options.maxConnections).toBe(1000);
      expect(router.options.maxBufferSize).toBe(10 * 1024 * 1024);
      expect(router.options.cleanupInterval).toBe(5 * 60 * 1000);
    });

    test('应该使用自定义配置创建WebSocket路由器', () => {
      const customOptions = {
        protocol: 'ws',
        prefix: '/api/ws',
        ext: {
          maxFrameSize: 2 * 1024 * 1024,
          frameTimeout: 60000,
          heartbeatInterval: 10000,
          heartbeatTimeout: 20000,
          maxConnections: 500,
          maxBufferSize: 5 * 1024 * 1024,
          cleanupInterval: 3 * 60 * 1000
        }
      };

      (getProtocolConfig as jest.Mock).mockReturnValue(customOptions.ext);

      const router = new WebsocketRouter(mockApp, customOptions);

      expect(router.options.prefix).toBe('/api/ws');
      expect(router.options.maxFrameSize).toBe(2 * 1024 * 1024);
      expect(router.options.frameTimeout).toBe(60000);
      expect(router.options.heartbeatInterval).toBe(10000);
      expect(router.options.heartbeatTimeout).toBe(20000);
      expect(router.options.maxConnections).toBe(500);
      expect(router.options.maxBufferSize).toBe(5 * 1024 * 1024);
      expect(router.options.cleanupInterval).toBe(3 * 60 * 1000);
    });

    test('应该警告心跳间隔大于等于心跳超时', () => {
      const invalidOptions = {
        protocol: 'ws',
        prefix: '',
        ext: {
          heartbeatInterval: 30000,
          heartbeatTimeout: 25000 // 小于间隔时间
        }
      };

      (getProtocolConfig as jest.Mock).mockReturnValue(invalidOptions.ext);

      new WebsocketRouter(mockApp, invalidOptions);

      expect(DefaultLogger.Warn).toHaveBeenCalledWith(
        'heartbeatInterval should be less than heartbeatTimeout'
      );
    });

    test('应该正确设置路由', () => {
      const router = new WebsocketRouter(mockApp);
      const mockImplementation = {
        path: '/test',
        method: 'GET',
        handler: jest.fn()
      };

      (Helper.isEmpty as jest.Mock).mockReturnValue(false);

      router.SetRouter('TestRoute', mockImplementation);

      expect(router.ListRouter().get('TestRoute')).toEqual(mockImplementation);
      expect(router.ListRouter().size).toBe(1);
    });

    test('应该忽略空路径的路由设置', () => {
      const router = new WebsocketRouter(mockApp);
      const mockImplementation = {
        path: '',
        method: 'GET',
        handler: jest.fn()
      };

      (Helper.isEmpty as jest.Mock).mockReturnValue(true);

      router.SetRouter('EmptyRoute', mockImplementation);

      expect(router.ListRouter().size).toBe(0);
    });

    test('应该返回路由列表', () => {
      const router = new WebsocketRouter(mockApp);
      const mockImplementation1 = {
        path: '/test1',
        method: 'GET',
        handler: jest.fn()
      };
      const mockImplementation2 = {
        path: '/test2',
        method: 'POST',
        handler: jest.fn()
      };

      (Helper.isEmpty as jest.Mock).mockReturnValue(false);

      router.SetRouter('Route1', mockImplementation1);
      router.SetRouter('Route2', mockImplementation2);

      const routerList = router.ListRouter();
      expect(routerList.size).toBe(2);
      expect(routerList.get('Route1')).toEqual(mockImplementation1);
      expect(routerList.get('Route2')).toEqual(mockImplementation2);
    });

    test('应该获取连接统计信息', () => {
      const router = new WebsocketRouter(mockApp);

      const stats = router.getConnectionStats();

      expect(stats).toEqual({
        activeConnections: 0,
        totalBufferSize: 0,
        averageBufferSize: 0,
        maxConnections: 1000,
        maxBufferSize: 10 * 1024 * 1024
      });
    });

    test('应该正确清理资源', () => {
      const router = new WebsocketRouter(mockApp);
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      router.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    test('应该处理LoadRouter方法', async () => {
      const router = new WebsocketRouter(mockApp);
      const mockControllerList = [
        {
          id: 'TestController',
          target: class TestController {}
        }
      ];

      await router.LoadRouter(mockApp, mockControllerList);

      // 验证LoadRouter被调用且没有抛出错误
      expect(mockControllerList).toBeDefined();
    });

    test('应该处理空的控制器列表', async () => {
      const router = new WebsocketRouter(mockApp);

      await router.LoadRouter(mockApp, []);

      // 验证空列表不会导致错误
      expect(router.ListRouter().size).toBe(0);
    });

    test('应该正确处理协议配置', () => {
      const customConfig = {
        maxFrameSize: 512 * 1024,
        frameTimeout: 45000,
        heartbeatInterval: 20000,
        heartbeatTimeout: 40000,
        maxConnections: 2000,
        maxBufferSize: 20 * 1024 * 1024,
        cleanupInterval: 10 * 60 * 1000
      };

      (getProtocolConfig as jest.Mock).mockReturnValue(customConfig);

      const router = new WebsocketRouter(mockApp, { protocol: 'ws', prefix: '/ws' });

      expect(getProtocolConfig).toHaveBeenCalledWith('ws', {});
      expect(router.options.maxFrameSize).toBe(512 * 1024);
      expect(router.options.frameTimeout).toBe(45000);
      expect(router.options.heartbeatInterval).toBe(20000);
      expect(router.options.heartbeatTimeout).toBe(40000);
      expect(router.options.maxConnections).toBe(2000);
      expect(router.options.maxBufferSize).toBe(20 * 1024 * 1024);
      expect(router.options.cleanupInterval).toBe(10 * 60 * 1000);
    });
  });

  describe('WebSocket内存管理测试', () => {
    beforeEach(() => {
      (getProtocolConfig as jest.Mock).mockReturnValue({
        maxFrameSize: 1024,
        frameTimeout: 1000,
        heartbeatInterval: 500,
        heartbeatTimeout: 1000,
        maxConnections: 2,
        maxBufferSize: 2048,
        cleanupInterval: 100
      });
    });

    test('应该启动清理定时器', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      new WebsocketRouter(mockApp);

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        100 // cleanupInterval
      );
    });

    test('应该在cleanup时清理定时器', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const router = new WebsocketRouter(mockApp);

      router.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('WebSocket错误处理测试', () => {
    test('应该处理getProtocolConfig抛出的错误', () => {
      (getProtocolConfig as jest.Mock).mockImplementation(() => {
        throw new Error('Config error');
      });

      expect(() => {
        new WebsocketRouter(mockApp);
      }).toThrow('Config error');
    });

    test('应该处理无效配置参数', () => {
      // 测试无效的配置参数处理
      const invalidOptions = {
        protocol: 'ws',
        prefix: '/invalid',
        ext: {
          heartbeatInterval: -1000, // 无效值
          maxConnections: -1, // 无效值
          maxFrameSize: -1024 // 无效值
        }
      };

      (getProtocolConfig as jest.Mock).mockReturnValue(invalidOptions.ext);

      // 应该能够创建路由器，但会使用默认值
      const router = new WebsocketRouter(mockApp, invalidOptions);
      
      expect(router).toBeDefined();
      expect(router.protocol).toBe('ws');
    });
  });
}); 