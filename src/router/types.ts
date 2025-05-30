/*
 * @Description: Protocol-specific router configuration types
 * @Usage: Type definitions for ext parameters in RouterOptions
 * @Author: richen
 * @Date: 2025-01-20 10:00:00
 * @LastEditTime: 2025-01-20 10:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

/**
 * WebSocket 协议特定配置
 */
export interface WebSocketExtConfig {
  /** 最大分帧大小(字节)，默认1MB */
  maxFrameSize?: number;
  /** 分帧处理超时(ms)，默认30秒 */
  frameTimeout?: number;
  /** 心跳检测间隔(ms)，默认15秒 */
  heartbeatInterval?: number;
  /** 心跳超时时间(ms)，默认30秒 */
  heartbeatTimeout?: number;
  /** 最大连接数，默认1000 */
  maxConnections?: number;
  /** 最大缓冲区大小(字节)，默认10MB */
  maxBufferSize?: number;
  /** 清理间隔(ms)，默认5分钟 */
  cleanupInterval?: number;
}

/**
 * gRPC 流配置
 */
export interface StreamConfig {
  /** 最大并发流数量，默认50 */
  maxConcurrentStreams?: number;
  /** 流超时时间(ms)，默认60秒 */
  streamTimeout?: number;
  /** 背压阈值(字节)，默认2048 */
  backpressureThreshold?: number;
  /** 流缓冲区大小，默认1024 */
  streamBufferSize?: number;
  /** 是否启用流压缩，默认false */
  enableCompression?: boolean;
}

/**
 * gRPC 协议特定配置
 */
export interface GrpcExtConfig {
  /** Protocol Buffer 文件路径 */
  protoFile: string;
  /** 连接池大小，默认10 */
  poolSize?: number;
  /** 批处理大小，默认10 */
  batchSize?: number;
  /** 流配置 */
  streamConfig?: StreamConfig;
  /** gRPC 服务器选项 */
  serverOptions?: Record<string, any>;
  /** 是否启用反射，默认false */
  enableReflection?: boolean;
}

/**
 * GraphQL 协议特定配置
 */
export interface GraphQLExtConfig {
  /** GraphQL Schema 文件路径 */
  schemaFile: string;
  /** 启用 GraphQL Playground，默认false */
  playground?: boolean;
  /** 启用内省查询，默认true */
  introspection?: boolean;
  /** 调试模式，默认false */
  debug?: boolean;
  /** 查询深度限制，默认10 */
  depthLimit?: number;
  /** 查询复杂度限制，默认1000 */
  complexityLimit?: number;
  /** 自定义标量类型 */
  customScalars?: Record<string, any>;
  /** 中间件配置 */
  middlewares?: any[];
}

/**
 * HTTP 协议特定配置（目前为空，预留扩展）
 */
export interface HttpExtConfig {
  /** 自定义HTTP选项 */
  [key: string]: any;
}

/**
 * 协议扩展配置联合类型
 */
export type ProtocolExtConfig = 
  | WebSocketExtConfig 
  | GrpcExtConfig 
  | GraphQLExtConfig 
  | HttpExtConfig;

/**
 * 协议扩展配置映射
 */
export interface ProtocolExtConfigMap {
  http: HttpExtConfig;
  https: HttpExtConfig;
  ws: WebSocketExtConfig;
  wss: WebSocketExtConfig;
  grpc: GrpcExtConfig;
  graphql: GraphQLExtConfig;
}

/**
 * 获取协议特定配置的工具函数
 */
export function getProtocolConfig<T extends keyof ProtocolExtConfigMap>(
  protocol: T,
  ext: Record<string, any> = {}
): ProtocolExtConfigMap[T] {
  return ext as ProtocolExtConfigMap[T];
}

/**
 * 验证协议特定配置的工具函数
 */
export function validateProtocolConfig(
  protocol: string,
  ext: Record<string, any>
): boolean {
  switch (protocol.toLowerCase()) {
    case 'grpc':
      return typeof ext.protoFile === 'string' && ext.protoFile.length > 0;
    case 'graphql':
      return typeof ext.schemaFile === 'string' && ext.schemaFile.length > 0;
    case 'ws':
    case 'wss':
      // WebSocket 配置都是可选的
      return true;
    case 'http':
    case 'https':
      // HTTP 配置都是可选的
      return true;
    default:
      return false;
  }
} 