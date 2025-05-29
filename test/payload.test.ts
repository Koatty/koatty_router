/*
 * @Description: Payload module tests
 * @Usage: Test payload parsing functionality and caching
 * @Author: richen
 * @Date: 2025-01-20 10:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { payload, bodyParser, queryParser } from '../src/payload/payload';
import { PayloadCacheManager, cacheManager, clearTypeMapCache, getTypeMapCacheStats } from '../src/payload/payload_cache';
import { PayloadOptions } from '../src/payload/interface';

describe('Payload Module Tests', () => {
  beforeEach(() => {
    // 清理缓存
    clearTypeMapCache();
  });

  describe('PayloadCacheManager', () => {
    it('should create singleton instance', () => {
      const manager1 = PayloadCacheManager.getInstance();
      const manager2 = PayloadCacheManager.getInstance();
      
      expect(manager1).toBe(manager2);
      expect(manager1).toBeInstanceOf(PayloadCacheManager);
    });

    it('should cache typeMap correctly', () => {
      const manager = PayloadCacheManager.getInstance();
      const extTypes = {
        json: ['application/json'],
        form: ['application/x-www-form-urlencoded'],
        text: ['text/plain']
      };
      
      const typeMap1 = manager.getTypeMap(extTypes);
      const typeMap2 = manager.getTypeMap(extTypes);
      
      expect(typeMap1).toBe(typeMap2);
      expect(typeMap1).toBeInstanceOf(Map);
    });

    it('should parse content types correctly', () => {
      const manager = PayloadCacheManager.getInstance();
      
      const jsonType = manager.getContentType('application/json; charset=utf-8');
      const formType = manager.getContentType('application/x-www-form-urlencoded');
      const invalidType = manager.getContentType('invalid/type');
      
      expect(jsonType).toBe('application/json');
      expect(formType).toBe('application/x-www-form-urlencoded');
      expect(invalidType).toBeNull();
    });

    it('should merge options correctly', () => {
      const manager = PayloadCacheManager.getInstance();
      const options: PayloadOptions = {
        extTypes: {
          json: ['application/json'],
          form: ['application/x-www-form-urlencoded']
        },
        limit: '10mb',
        encoding: 'utf-8' as BufferEncoding,
        multiples: true,
        keepExtensions: true
      };
      
      const mergedOptions = manager.getMergedOptions(options);
      
      expect(mergedOptions.limit).toBe('10mb');
      expect(mergedOptions.encoding).toBe('utf-8');
      expect(mergedOptions.multiples).toBe(true);
      expect(mergedOptions.keepExtensions).toBe(true);
    });

    it('should provide cache statistics', () => {
      const stats = getTypeMapCacheStats();
      
      expect(stats).toHaveProperty('typeMap');
      expect(stats).toHaveProperty('contentType');
      expect(stats).toHaveProperty('options');
      expect(stats).toHaveProperty('overall');
      
      expect(typeof stats.typeMap.size).toBe('number');
      expect(typeof stats.typeMap.maxSize).toBe('number');
      expect(typeof stats.typeMap.utilizationRate).toBe('number');
    });
  });

  describe('Payload Middleware', () => {
    it('should create middleware function', () => {
      const middleware = payload();
      
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware with custom options', () => {
      const options: PayloadOptions = {
        extTypes: {
          json: ['application/json'],
          form: ['application/x-www-form-urlencoded']
        },
        limit: '5mb',
        encoding: 'utf-8',
        multiples: false,
        keepExtensions: false
      };
      
      const middleware = payload(options);
      
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Query Parser', () => {
    it('should parse query parameters only', () => {
      const mockCtx = {
        query: { name: 'test', age: '25' },
        params: {}
      } as any;
      
      const result = queryParser(mockCtx);
      
      expect(result).toEqual({ name: 'test', age: '25' });
    });

    it('should parse route parameters only', () => {
      const mockCtx = {
        query: {},
        params: { id: '123', type: 'user' }
      } as any;
      
      const result = queryParser(mockCtx);
      
      expect(result).toEqual({ id: '123', type: 'user' });
    });

    it('should merge query and route parameters', () => {
      const mockCtx = {
        query: { name: 'test', age: '25' },
        params: { id: '123', type: 'user' }
      } as any;
      
      const result = queryParser(mockCtx);
      
      expect(result).toEqual({
        name: 'test',
        age: '25',
        id: '123',
        type: 'user'
      });
    });

    it('should handle empty parameters', () => {
      const mockCtx = {
        query: {},
        params: {}
      } as any;
      
      const result = queryParser(mockCtx);
      
      expect(result).toEqual({});
    });
  });

  describe('Body Parser', () => {
    it('should return cached body if available', async () => {
      const cachedBody = { test: 'data' };
      const mockCtx = {
        getMetaData: jest.fn().mockReturnValue([cachedBody]),
        setMetaData: jest.fn()
      } as any;
      
      const result = await bodyParser(mockCtx);
      
      expect(result).toBe(cachedBody);
      expect(mockCtx.getMetaData).toHaveBeenCalledWith('_body');
    });

    it('should return empty object for unsupported methods', async () => {
      const mockCtx = {
        method: 'GET',
        getMetaData: jest.fn().mockReturnValue([null]),
        setMetaData: jest.fn(),
        req: { headers: {} },
        request: { headers: {} }
      } as any;
      
      const result = await bodyParser(mockCtx);
      
      expect(result).toEqual({});
    });

    it('should handle parsing errors gracefully', async () => {
      const mockCtx = {
        method: 'POST',
        getMetaData: jest.fn().mockReturnValue([null]),
        setMetaData: jest.fn(),
        req: { headers: {} },
        request: { headers: { 'content-type': 'application/json' } }
      } as any;
      
      const result = await bodyParser(mockCtx);
      
      expect(result).toEqual({});
    });
  });

  describe('Cache Performance', () => {
    it('should maintain cache size limits', () => {
      const manager = PayloadCacheManager.getInstance();
      
      // 创建多个不同的配置来测试缓存限制
      for (let i = 0; i < 60; i++) {
        const extTypes = {
          [`custom-${i}`]: [`application/custom-${i}`]
        };
        manager.getTypeMap(extTypes);
      }
      
      const stats = getTypeMapCacheStats();
      
      // 验证缓存大小被限制
      expect(stats.typeMap.size).toBeLessThanOrEqual(stats.typeMap.maxSize);
    });

    it('should reuse cached typeMap for identical configurations', () => {
      const manager = PayloadCacheManager.getInstance();
      const extTypes = {
        json: ['application/json'],
        form: ['application/x-www-form-urlencoded']
      };
      
      // 第一次调用 - 创建缓存
      const typeMap1 = manager.getTypeMap(extTypes);
      
      // 第二次调用 - 使用缓存
      const typeMap2 = manager.getTypeMap(extTypes);
      
      // 验证返回的是同一个对象（缓存命中）
      expect(typeMap1).toBe(typeMap2);
      expect(typeMap1).toBeInstanceOf(Map);
      expect(typeMap1.size).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid content types', () => {
      const manager = PayloadCacheManager.getInstance();
      
      const result1 = manager.getContentType('');
      const result2 = manager.getContentType('invalid');
      const result3 = manager.getContentType('text/html');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should handle null/undefined options', () => {
      const manager = PayloadCacheManager.getInstance();
      
      const result1 = manager.getMergedOptions(undefined);
      const result2 = manager.getMergedOptions(null as any);
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.limit).toBe('20mb'); // 默认值
      expect(result2.limit).toBe('20mb'); // 默认值
    });
  });
}); 