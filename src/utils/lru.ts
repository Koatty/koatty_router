/*
 * @Description: LRU Cache Implementation
 * @Usage: Memory-efficient caching with automatic cleanup
 * @Author: richen
 * @Date: 2025-01-20 10:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

/**
 * LRU Cache implementation for memory management
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache = new Map<K, V>();

  constructor(capacity: number = 100) {
    this.capacity = capacity;
  }

  /**
   * Get value from cache and mark as recently used
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  /**
   * Set value in cache with LRU eviction
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Set new capacity and evict if necessary
   */
  setCapacity(newCapacity: number): void {
    this.capacity = newCapacity;
    
    // Evict excess entries if new capacity is smaller
    while (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Get all keys in order of usage (least to most recent)
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values in order of usage (least to most recent)
   */
  values(): V[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    capacity: number;
    utilizationRate: number;
  } {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      utilizationRate: this.cache.size / this.capacity
    };
  }
} 