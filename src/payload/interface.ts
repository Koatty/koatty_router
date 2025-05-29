/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-12-09 12:02:29
 * @LastEditTime: 2025-03-15 22:21:29
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

/**
 * 请求参数选项
 */
export interface PayloadOptions {
  extTypes: Record<string, string[]>;
  limit: string;
  encoding: BufferEncoding;
  multiples: boolean;
  keepExtensions: boolean;
  length?: number;
}