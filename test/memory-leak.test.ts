/*
 * @Description: Memory leak prevention tests
 * @Author: richen
 * @Date: 2025-01-20 10:00:00
 * @LastEditTime: 2025-01-20 10:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { LRUCache } from "lru-cache";
import { RouterMiddlewareManager } from "../src/middleware/manager";

describe('LRUCache', () => {
  it('should limit cache size', () => {
    const cache = new LRUCache<string, number>({ max: 3 });
    
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // This should evict 'a'
    
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
    expect(cache.size).toBe(3);
  });

  it('should move accessed items to front', () => {
    const cache = new LRUCache<string, number>({ max: 3 });
    
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    
    // Access 'a' to move it to front
    cache.get('a');
    
    cache.set('d', 4); // This should evict 'b' (least recently used)
    
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  it('should prevent memory leaks with large datasets', () => {
    const cache = new LRUCache<string, number>({ max: 10 });
    
    // Add many items
    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, i);
    }
    
    // Cache should only contain 10 items
    expect(cache.size).toBe(10);
    
    // Should contain the last 10 items
    for (let i = 990; i < 1000; i++) {
      expect(cache.has(`key${i}`)).toBe(true);
    }
    
    // Should not contain early items
    expect(cache.has('key0')).toBe(false);
    expect(cache.has('key100')).toBe(false);
  });
});

describe('Memory Leak Prevention', () => {
  
  describe('RouterMiddlewareManager Memory Management', () => {
    let manager: RouterMiddlewareManager;

    beforeEach(() => {
      RouterMiddlewareManager.resetInstance();
      manager = RouterMiddlewareManager.getInstance();
    });

    afterEach(() => {
      RouterMiddlewareManager.resetInstance();
    });

    it('should limit cache sizes and prevent memory leaks', () => {
      // 注册大量中间件以测试缓存限制
      for (let i = 0; i < 500; i++) {
        manager.register({
          name: `middleware-${i}`,
          middleware: async (ctx, next) => await next(),
          conditions: [
            { type: 'path', value: `/path-${i}`, operator: 'equals' },
            { type: 'method', value: 'GET' },
            { type: 'header', value: `x-header-${i}:value-${i}` }
          ]
        });
      }

      const memStats = manager.getMemoryStats();
      
      // 验证缓存大小被限制
      expect(memStats.pathPatternsSize).toBeLessThanOrEqual(350); // 200+100+100+50
      expect(memStats.methodCacheSize).toBeLessThanOrEqual(100);
      expect(memStats.headerCacheSize).toBeLessThanOrEqual(100);
      
      console.log('Memory stats:', memStats);
    });

    it('should cleanup execution statistics periodically', () => {
      // 模拟大量执行统计
      const stats = (manager as any).executionStats;
      
      for (let i = 0; i < 2000; i++) {
        stats.set(`middleware-${i}`, {
          executions: Math.floor(Math.random() * 100),
          totalTime: Math.floor(Math.random() * 1000),
          errors: Math.floor(Math.random() * 10)
        });
      }

      expect(stats.size).toBe(2000);

      // 触发清理
      (manager as any).cleanupExecutionStats();

      // 验证统计数据被清理到合理大小
      expect(stats.size).toBeLessThanOrEqual(500);
    });

    it('should properly destroy and cleanup resources', () => {
      manager.register({
        name: 'test-middleware',
        middleware: async (ctx, next) => await next()
      });

      const memStatsBefore = manager.getMemoryStats();
      expect(memStatsBefore.middlewareCount).toBe(4); // 3 built-in + 1 test

      manager.destroy();

      // 验证资源被清理
      expect((manager as any).cacheCleanupTimer).toBeUndefined();
    });
  });
}); 