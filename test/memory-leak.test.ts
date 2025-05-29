/*
 * @Description: Memory Leak Prevention Tests
 * @Usage: Test LRU cache and memory management
 * @Author: richen
 * @Date: 2025-01-20 10:00:00
 * @License: BSD (3-Clause)
 */

import { LRUCache } from "../src/utils/lru";
import { RouterMiddlewareManager } from "../src/middleware/manager";

describe('Memory Leak Prevention', () => {
  
  describe('LRUCache', () => {
    it('should limit cache size and evict old entries', () => {
      const cache = new LRUCache<string, number>(3);
      
      // 添加超过容量的条目
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // 应该驱逐 'a'
      
      expect(cache.size()).toBe(3);
      expect(cache.has('a')).toBe(false);
      expect(cache.has('d')).toBe(true);
    });

    it('should update LRU order on access', () => {
      const cache = new LRUCache<string, number>(3);
      
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      
      // 访问 'a' 使其成为最近使用的
      cache.get('a');
      
      // 添加新条目应该驱逐 'b'（最少使用的）
      cache.set('d', 4);
      
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('c')).toBe(true);
      expect(cache.has('d')).toBe(true);
    });

    it('should provide cache statistics', () => {
      const cache = new LRUCache<string, number>(10);
      cache.set('a', 1);
      cache.set('b', 2);
      
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.capacity).toBe(10);
      expect(stats.utilizationRate).toBe(0.2);
    });
  });

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