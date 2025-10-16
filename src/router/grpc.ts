/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:10:30
 * @LastEditTime: 2025-04-06 22:56:00
 */
import { UntypedHandleCall, ServerReadableStream, ServerWritableStream, ServerDuplexStream } from "@grpc/grpc-js";
import { IOC } from "koatty_container";
import {
  IRpcServerCall,
  IRpcServerCallback,
  Koatty, KoattyRouter,
  RouterImplementation
} from "koatty_core";
import * as Helper from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { ListServices, LoadProto } from "koatty_proto";
import { injectParamMetaData, injectRouter, ParamMetadata } from "../utils/inject";
import { parsePath } from "../utils/path";
import { RouterOptions } from "./router";
import { Handler } from "../utils/handler";
import { getProtocolConfig, validateProtocolConfig } from "./types";

/**
 * gRPC流类型枚举
 */
export enum GrpcStreamType {
  UNARY = 'unary',
  SERVER_STREAMING = 'server_streaming',
  CLIENT_STREAMING = 'client_streaming',
  BIDIRECTIONAL_STREAMING = 'bidirectional_streaming'
}

/**
 * 流处理配置
 */
export interface StreamConfig {
  maxConcurrentStreams?: number;
  streamTimeout?: number;
  backpressureThreshold?: number;
  bufferSize?: number;
}

/**
 * GrpcRouter Options
 */
export interface GrpcRouterOptions extends RouterOptions {
  protoFile: string;
  poolSize?: number;
  batchSize?: number;
  streamConfig?: StreamConfig;
}

/**
 * 流状态管理
 */
interface StreamState {
  id: string;
  type: GrpcStreamType;
  startTime: number;
  messageCount: number;
  bufferSize: number;
  isActive: boolean;
}

/**
 * Connection pool for gRPC clients
 */
class GrpcConnectionPool {
  private pool: Map<string, any[]>;
  private maxSize: number;

  constructor(maxSize: number = 10) {
    this.pool = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get connection from pool or create new one
   */
  get(serviceName: string, options?: any): any {
    const connections = this.pool.get(serviceName);
    if (connections && connections.length > 0) {
      const conn = connections.pop();
      Logger.Debug(`Reused connection from pool for service: ${serviceName}`);
      return conn;
    }
    
    // No available connection, create new one
    Logger.Debug(`Creating new connection for service: ${serviceName}`);
    return this.create(serviceName, options);
  }

  /**
   * Release connection back to pool
   */
  release(serviceName: string, connection: any): void {
    if (!connection) return;
    
    if (!this.pool.has(serviceName)) {
      this.pool.set(serviceName, []);
    }
    
    const connections = this.pool.get(serviceName)!;
    if (connections.length < this.maxSize) {
      connections.push(connection);
      Logger.Debug(`Connection released back to pool for service: ${serviceName}, pool size: ${connections.length}`);
    } else {
      // Pool is full, close the connection
      if (connection.close && typeof connection.close === 'function') {
        connection.close();
      }
      Logger.Debug(`Pool full for service: ${serviceName}, connection closed`);
    }
  }

  /**
   * Create new connection
   * @param serviceName - Name of the gRPC service
   * @param options - gRPC client options
   * @returns Connection object (placeholder, actual implementation depends on gRPC client library)
   */
  private create(serviceName: string, options?: any): any {
    // NOTE: This is a placeholder implementation
    // In a real scenario, you would create an actual gRPC client connection:
    // 
    // Example with @grpc/grpc-js:
    // const grpc = require('@grpc/grpc-js');
    // const client = new ServiceClient(
    //   'localhost:50051',
    //   grpc.credentials.createInsecure(),
    //   options
    // );
    // return client;
    
    Logger.Debug(`Creating connection stub for service: ${serviceName}`);
    return {
      serviceName,
      createdAt: Date.now(),
      options,
      // Placeholder methods
      close: () => {
        Logger.Debug(`Closing connection for service: ${serviceName}`);
      }
    };
  }

  /**
   * Cleanup all connections in the pool
   */
  clear(): void {
    let totalConnections = 0;
    
    // Close all connections before clearing
    for (const [_serviceName, connections] of this.pool.entries()) {
      for (const connection of connections) {
        if (connection && connection.close && typeof connection.close === 'function') {
          connection.close();
        }
        totalConnections++;
      }
    }
    
    this.pool.clear();
    Logger.Info(`gRPC connection pool cleared, closed ${totalConnections} connections`);
  }
  
  /**
   * Get pool statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [serviceName, connections] of this.pool.entries()) {
      stats[serviceName] = connections.length;
    }
    return stats;
  }
}

/**
 * Batch processor for gRPC requests
 */
class GrpcBatchProcessor {
  private batchSize: number;
  private batchQueue: Map<string, any[]>;
  private batchTimers: Map<string, NodeJS.Timeout>;

  constructor(batchSize: number = 10) {
    this.batchSize = batchSize;
    this.batchQueue = new Map();
    this.batchTimers = new Map();
  }

  /**
   * Add request to batch
   */
  addRequest(serviceName: string, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.batchQueue.has(serviceName)) {
        this.batchQueue.set(serviceName, []);
      }

      const queue = this.batchQueue.get(serviceName)!;
      queue.push({ request, resolve, reject });

      // Process batch if size reached
      if (queue.length >= this.batchSize) {
        this.processBatch(serviceName);
      } else if (!this.batchTimers.has(serviceName)) {
        // Start timer for batch processing
        this.batchTimers.set(serviceName, setTimeout(() => {
          this.processBatch(serviceName);
        }, 100));
      }
    });
  }

  /**
   * Process batch of requests
   */
  private processBatch(serviceName: string): void {
    const queue = this.batchQueue.get(serviceName);
    if (!queue || queue.length === 0) return;

    const timer = this.batchTimers.get(serviceName);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(serviceName);
    }
    
    Logger.Debug(`Processing batch for service ${serviceName}, ${queue.length} requests`);
    
    // NOTE: This is a placeholder implementation
    // In a real scenario, you would:
    // 1. Combine all requests into a single gRPC batch call
    // 2. Send the batch to the service
    // 3. Process the batch response
    // 4. Resolve/reject each individual promise
    
    // Example implementation:
    // const batchRequest = { requests: queue.map(item => item.request) };
    // grpcClient.batchCall(batchRequest, (error, response) => {
    //   if (error) {
    //     queue.forEach(item => item.reject(error));
    //   } else {
    //     response.results.forEach((result, index) => {
    //       queue[index].resolve(result);
    //     });
    //   }
    // });
    
    // Placeholder: immediately resolve all requests
    queue.forEach((item, index) => {
      try {
        // Simulate successful response
        item.resolve({
          success: true,
          data: item.request,
          batchIndex: index,
          batchSize: queue.length
        });
      } catch (error) {
        item.reject(error);
      }
    });

    this.batchQueue.delete(serviceName);
    Logger.Debug(`Batch processing completed for service ${serviceName}`);
  }

  /**
   * Flush all pending batches and cleanup
   */
  flush(): void {
    let totalProcessed = 0;
    
    // Process all pending batches
    for (const serviceName of this.batchQueue.keys()) {
      const queueSize = this.batchQueue.get(serviceName)?.length || 0;
      this.processBatch(serviceName);
      totalProcessed += queueSize;
    }

    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();

    Logger.Info(`gRPC batch processor flushed, processed ${totalProcessed} pending requests`);
  }
  
  /**
   * Get batch queue statistics
   */
  getStats(): { serviceName: string; queueSize: number }[] {
    const stats: { serviceName: string; queueSize: number }[] = [];
    for (const [serviceName, queue] of this.batchQueue.entries()) {
      stats.push({
        serviceName,
        queueSize: queue.length
      });
    }
    return stats;
  }
}

/**
 * 流管理器
 */
class StreamManager {
  private streams: Map<string, StreamState>;
  private config: StreamConfig;

  constructor(config: StreamConfig = {}) {
    this.streams = new Map();
    this.config = {
      maxConcurrentStreams: config.maxConcurrentStreams || 100,
      streamTimeout: config.streamTimeout || 300000, // 5分钟
      backpressureThreshold: config.backpressureThreshold || 1000,
      bufferSize: config.bufferSize || 64 * 1024, // 64KB
      ...config
    };
  }

  /**
   * 注册新流
   */
  registerStream(id: string, type: GrpcStreamType): StreamState {
    const state: StreamState = {
      id,
      type,
      startTime: Date.now(),
      messageCount: 0,
      bufferSize: 0,
      isActive: true
    };
    
    this.streams.set(id, state);
    this.cleanupExpiredStreams();
    
    return state;
  }

  /**
   * 更新流状态
   */
  updateStream(id: string, updates: Partial<StreamState>): void {
    const state = this.streams.get(id);
    if (state) {
      Object.assign(state, updates);
    }
  }

  /**
   * 移除流
   */
  removeStream(id: string): void {
    this.streams.delete(id);
  }

  /**
   * 检查是否达到背压阈值
   */
  isBackpressureTriggered(id: string): boolean {
    const state = this.streams.get(id);
    return state ? state.bufferSize > this.config.backpressureThreshold! : false;
  }

  /**
   * 清理过期流
   */
  private cleanupExpiredStreams(): void {
    const now = Date.now();
    for (const [id, state] of this.streams.entries()) {
      if (now - state.startTime > this.config.streamTimeout!) {
        Logger.Warn(`Stream ${id} expired, removing...`);
        this.streams.delete(id);
      }
    }
  }

  /**
   * 获取活跃流数量
   */
  getActiveStreamCount(): number {
    return Array.from(this.streams.values()).filter(s => s.isActive).length;
  }

  /**
   * Close all active streams
   */
  closeAllStreams(): void {
    const activeCount = this.getActiveStreamCount();
    if (activeCount > 0) {
      Logger.Info(`Closing ${activeCount} active gRPC streams...`);
    }

    for (const [id, state] of this.streams.entries()) {
      if (state.isActive) {
        state.isActive = false;
        Logger.Debug(`Closed stream: ${id}`);
      }
    }

    this.streams.clear();
    Logger.Debug('All gRPC streams closed');
  }
}

/**
 * CtlInterface
 *
 * @interface CtlInterface
 */
interface CtlInterface {
  [path: string]: {
    name: string;
    ctl: Function;
    method: string;
    params: ParamMetadata[];
    composedMiddleware?: Function;
  }
}

export class GrpcRouter implements KoattyRouter {
  readonly protocol: string;
  options: GrpcRouterOptions;
  router: Map<string, RouterImplementation>;
  private connectionPool: GrpcConnectionPool;
  private batchProcessor: GrpcBatchProcessor;
  private streamManager: StreamManager;

  constructor(app: Koatty, options: RouterOptions = { protocol: "grpc", prefix: "" }) {
    const extConfig = getProtocolConfig('grpc', options.ext || {});
    
    // 配置验证
    const validation = validateProtocolConfig('grpc', options.ext || {});
    if (!validation.valid) {
      throw new Error(`gRPC router configuration error: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      validation.warnings.forEach((warning: string) => Logger.Warn(`[GrpcRouter] ${warning}`));
    }
    
    this.options = {
      ...options,
      protoFile: extConfig.protoFile,
      poolSize: extConfig.poolSize || 10,
      batchSize: extConfig.batchSize || 10,
      streamConfig: extConfig.streamConfig || {}
    } as GrpcRouterOptions;
    
    this.protocol = options.protocol || "grpc";
    this.router = new Map();
    this.connectionPool = new GrpcConnectionPool(this.options.poolSize);
    this.batchProcessor = new GrpcBatchProcessor(this.options.batchSize);
    this.streamManager = new StreamManager(this.options.streamConfig);
  }

  /**
   * SetRouter
   * @param name 
   * @param impl 
   * @returns 
   */
  SetRouter(name: string, impl?: RouterImplementation) {
    if (Helper.isEmpty(name)) return;
    this.router.set(name, {
      service: impl?.service,
      implementation: impl?.implementation
    });
  }

  /**
   * ListRouter
   *
   * @returns {*}  {Map<string, ServiceImplementation>}
   * @memberof GrpcRouter
   */
  ListRouter(): Map<string, RouterImplementation> {
    return this.router;
  }

  /**
   * 检测gRPC流类型
   */
  private detectStreamType(call: any): GrpcStreamType {
    // 检查call对象的属性来确定流类型
    const isReadable = call.readable || (call.on && typeof call.read === 'function');
    const isWritable = call.writable || (call.write && typeof call.write === 'function');
    
    if (isReadable && isWritable) {
      return GrpcStreamType.BIDIRECTIONAL_STREAMING;
    } else if (isReadable) {
      return GrpcStreamType.CLIENT_STREAMING;
    } else if (isWritable) {
      return GrpcStreamType.SERVER_STREAMING;
    } else {
      return GrpcStreamType.UNARY;
    }
  }

  /**
   * 处理一元调用 (Unary RPC)
   */
  private handleUnaryCall(
    call: IRpcServerCall<any, any>, 
    callback: IRpcServerCallback<any>,
    app: Koatty,
    ctlItem: any
  ): void {
    try {
      Logger.Debug(`Handling unary call for ${ctlItem.name}.${ctlItem.method}`);
      
      app.callback("grpc", (ctx) => {
        const ctl = IOC.getInsByClass(ctlItem.ctl, [ctx]);
        return Handler(app, ctx, ctl, ctlItem.method, ctlItem.params, undefined, ctlItem.composedMiddleware);
      })(call, callback);
    } catch (error) {
      Logger.Error(`Error in unary call: ${error}`);
      callback(error as Error);
    }
  }

  /**
   * 处理服务器流 (Server Streaming RPC)
   */
  private handleServerStreaming(
    call: ServerWritableStream<any, any>,
    app: Koatty,
    ctlItem: any
  ): void {
    const streamId = `server_${Date.now()}_${Math.random()}`;
    const streamState = this.streamManager.registerStream(streamId, GrpcStreamType.SERVER_STREAMING);
    
    try {
      Logger.Debug(`Handling server streaming call for ${ctlItem.name}.${ctlItem.method}`);
      
      // 设置流超时
      const timeout = setTimeout(() => {
        Logger.Warn(`Server stream ${streamId} timeout`);
        call.end();
        this.streamManager.removeStream(streamId);
      }, this.options.streamConfig?.streamTimeout || 300000);

      // 处理流结束
      call.on('cancelled', () => {
        Logger.Debug(`Server stream ${streamId} cancelled`);
        clearTimeout(timeout);
        this.streamManager.removeStream(streamId);
      });

      call.on('error', (error) => {
        Logger.Error(`Server stream ${streamId} error:`, error);
        clearTimeout(timeout);
        this.streamManager.removeStream(streamId);
      });

      // 创建自定义上下文，包含流写入方法
      app.callback("grpc", (ctx) => {
        // 添加流写入方法到上下文
        ctx.writeStream = (data: any) => {
          if (this.streamManager.isBackpressureTriggered(streamId)) {
            Logger.Warn(`Backpressure triggered for stream ${streamId}`);
            return false;
          }
          
          call.write(data);
          this.streamManager.updateStream(streamId, { 
            messageCount: streamState.messageCount + 1 
          });
          return true;
        };
        
        ctx.endStream = () => {
          call.end();
          clearTimeout(timeout);
          this.streamManager.removeStream(streamId);
        };

        const ctl = IOC.getInsByClass(ctlItem.ctl, [ctx]);
        return Handler(app, ctx, ctl, ctlItem.method, ctlItem.params, undefined, ctlItem.composedMiddleware);
      })(call, () => {});
      
    } catch (error) {
      Logger.Error(`Error in server streaming: ${error}`);
      call.end();
      this.streamManager.removeStream(streamId);
    }
  }

  /**
   * 处理客户端流 (Client Streaming RPC)
   */
  private handleClientStreaming(
    call: ServerReadableStream<any, any>,
    callback: IRpcServerCallback<any>,
    app: Koatty,
    ctlItem: any
  ): void {
    const streamId = `client_${Date.now()}_${Math.random()}`;
    const streamState = this.streamManager.registerStream(streamId, GrpcStreamType.CLIENT_STREAMING);
    const messages: any[] = [];
    
    try {
      Logger.Debug(`Handling client streaming call for ${ctlItem.name}.${ctlItem.method}`);
      
      // 设置流超时
      const timeout = setTimeout(() => {
        Logger.Warn(`Client stream ${streamId} timeout`);
        callback(new Error('Stream timeout'));
        this.streamManager.removeStream(streamId);
      }, this.options.streamConfig?.streamTimeout || 300000);

      // 处理数据接收
      call.on('data', (data: any) => {
        messages.push(data);
        this.streamManager.updateStream(streamId, { 
          messageCount: streamState.messageCount + 1,
          bufferSize: streamState.bufferSize + JSON.stringify(data).length
        });
        
        // 检查背压
        if (this.streamManager.isBackpressureTriggered(streamId)) {
          Logger.Warn(`Backpressure triggered for client stream ${streamId}`);
          call.pause();
          setTimeout(() => call.resume(), 100);
        }
      });

      // 处理流结束
      call.on('end', () => {
        clearTimeout(timeout);
        Logger.Debug(`Client stream ${streamId} ended with ${messages.length} messages`);
        
        // 处理所有接收到的消息
        app.callback("grpc", (ctx) => {
          ctx.streamMessages = messages;
          const ctl = IOC.getInsByClass(ctlItem.ctl, [ctx]);
          return Handler(app, ctx, ctl, ctlItem.method, ctlItem.params, undefined, ctlItem.composedMiddleware);
        })(call, callback);
        
        this.streamManager.removeStream(streamId);
      });

      call.on('error', (error) => {
        Logger.Error(`Client stream ${streamId} error:`, error);
        clearTimeout(timeout);
        callback(error);
        this.streamManager.removeStream(streamId);
      });

      call.on('cancelled', () => {
        Logger.Debug(`Client stream ${streamId} cancelled`);
        clearTimeout(timeout);
        this.streamManager.removeStream(streamId);
      });
      
    } catch (error) {
      Logger.Error(`Error in client streaming: ${error}`);
      callback(error as Error);
      this.streamManager.removeStream(streamId);
    }
  }

  /**
   * 处理双向流 (Bidirectional Streaming RPC)
   */
  private handleBidirectionalStreaming(
    call: ServerDuplexStream<any, any>,
    app: Koatty,
    ctlItem: any
  ): void {
    const streamId = `bidi_${Date.now()}_${Math.random()}`;
    const streamState = this.streamManager.registerStream(streamId, GrpcStreamType.BIDIRECTIONAL_STREAMING);
    
    try {
      Logger.Debug(`Handling bidirectional streaming call for ${ctlItem.name}.${ctlItem.method}`);
      
      // 设置流超时
      const timeout = setTimeout(() => {
        Logger.Warn(`Bidirectional stream ${streamId} timeout`);
        call.end();
        this.streamManager.removeStream(streamId);
      }, this.options.streamConfig?.streamTimeout || 300000);

      // 处理数据接收
      call.on('data', (data: any) => {
        this.streamManager.updateStream(streamId, { 
          messageCount: streamState.messageCount + 1,
          bufferSize: streamState.bufferSize + JSON.stringify(data).length
        });
        
        // 检查背压
        if (this.streamManager.isBackpressureTriggered(streamId)) {
          Logger.Warn(`Backpressure triggered for bidirectional stream ${streamId}`);
          call.pause();
          setTimeout(() => call.resume(), 100);
        }

        // 为每个消息创建处理上下文
        app.callback("grpc", (ctx) => {
          ctx.streamMessage = data;
          ctx.writeStream = (responseData: any) => {
            if (this.streamManager.isBackpressureTriggered(streamId)) {
              Logger.Warn(`Write backpressure triggered for stream ${streamId}`);
              return false;
            }
            call.write(responseData);
            return true;
          };
          
          ctx.endStream = () => {
            call.end();
            clearTimeout(timeout);
            this.streamManager.removeStream(streamId);
          };

          const ctl = IOC.getInsByClass(ctlItem.ctl, [ctx]);
          return Handler(app, ctx, ctl, ctlItem.method, ctlItem.params, undefined, ctlItem.composedMiddleware);
        })(call, () => {});
      });

      // 处理流结束
      call.on('end', () => {
        Logger.Debug(`Bidirectional stream ${streamId} ended`);
        clearTimeout(timeout);
        call.end();
        this.streamManager.removeStream(streamId);
      });

      call.on('error', (error) => {
        Logger.Error(`Bidirectional stream ${streamId} error:`, error);
        clearTimeout(timeout);
        call.end();
        this.streamManager.removeStream(streamId);
      });

      call.on('cancelled', () => {
        Logger.Debug(`Bidirectional stream ${streamId} cancelled`);
        clearTimeout(timeout);
        this.streamManager.removeStream(streamId);
      });
      
    } catch (error) {
      Logger.Error(`Error in bidirectional streaming: ${error}`);
      call.end();
      this.streamManager.removeStream(streamId);
    }
  }

  /**
   * 统一的流处理入口
   */
  private handleStreamCall(
    call: IRpcServerCall<any, any>, 
    callback: IRpcServerCallback<any>,
    app: Koatty,
    ctlItem: any
  ): void {
    const streamType = this.detectStreamType(call);
    
    // 检查并发流限制
    if (this.streamManager.getActiveStreamCount() >= (this.options.streamConfig?.maxConcurrentStreams || 100)) {
      Logger.Warn('Maximum concurrent streams reached');
      if (streamType === GrpcStreamType.UNARY) {
        callback(new Error('Server busy'));
      } else {
        (call as any).end();
      }
      return;
    }

    Logger.Debug(`Detected stream type: ${streamType} for ${ctlItem.name}.${ctlItem.method}`);

    switch (streamType) {
      case GrpcStreamType.UNARY:
        this.handleUnaryCall(call, callback, app, ctlItem);
        break;
      case GrpcStreamType.SERVER_STREAMING:
        this.handleServerStreaming(call as ServerWritableStream<any, any>, app, ctlItem);
        break;
      case GrpcStreamType.CLIENT_STREAMING:
        this.handleClientStreaming(call as ServerReadableStream<any, any>, callback, app, ctlItem);
        break;
      case GrpcStreamType.BIDIRECTIONAL_STREAMING:
        this.handleBidirectionalStreaming(call as ServerDuplexStream<any, any>, app, ctlItem);
        break;
      default:
        Logger.Error(`Unknown stream type: ${streamType}`);
        if (callback) {
          callback(new Error('Unknown stream type'));
        }
    }
  }

  /**
   * LoadRouter
   *
   * @memberof Router
   */
  async LoadRouter(app: Koatty, list: any[]) {
    try {
      const pdef = LoadProto(this.options.protoFile);
      const services = ListServices(pdef);
      const ctls: CtlInterface = {};

      for (const n of list) {
        const ctlClass = IOC.getClass(n, "CONTROLLER");
        const ctlRouters = await injectRouter(app, ctlClass, this.options.protocol);
        if (!ctlRouters) continue;

        // 传递 protoFile 给 payload 解析器，用于可能的自动解码
        const ctlParams = injectParamMetaData(app, ctlClass, {
          ...this.options.payload,
          protoFile: this.options.protoFile
        });
        for (const router of Object.values(ctlRouters)) {
          ctls[router.path] = {
            name: n,
            ctl: ctlClass,
            method: router.method,
            params: ctlParams[router.method],
            composedMiddleware: router.composedMiddleware
          };
        }
      }

      for (const si of services) {
        if (!si.service || si.handlers.length === 0) {
          Logger.Warn('Ignore', si.name, 'which is an empty service');
          continue;
        }

        const impl: Record<string, UntypedHandleCall> = {};
        for (const handler of si.handlers) {
          const path = parsePath(handler.path);
          const ctlItem = ctls[path];
          if (!ctlItem) continue;

          Logger.Debug(`Register request mapping: ["${path}" => ${ctlItem.name}.${ctlItem.method}]`);
          impl[handler.name] = (call: IRpcServerCall<any, any>, callback: IRpcServerCallback<any>) => {
            this.handleStreamCall(call, callback, app, ctlItem);
          };
        }
        
        // only register service when impl is not empty
        if (Object.keys(impl).length > 0) {
          this.SetRouter(si.name, { service: si.service, implementation: impl });
          
          // Handle both single server and multi-protocol server
          const server = app.server as any;
          let grpcServer = null;
          
          // Check if server is an array (multi-protocol mode)
          if (Helper.isArray(server)) {
            // Multi-protocol server: app.server is array of SingleProtocolServer instances
            Logger.Debug(`Detecting gRPC server in multi-protocol array mode (${server.length} servers)`);
            for (let i = 0; i < server.length; i++) {
              const s = server[i];
              const protocol = s.options?.protocol || s.protocol;
              if (protocol === 'grpc' && Helper.isFunction(s.RegisterService)) {
                grpcServer = s;
                Logger.Debug(`Found gRPC server instance at array index ${i}`);
                break;
              }
            }
          } else if (Helper.isFunction(server?.getAllServers)) {
            // Alternative multi-protocol structure with getAllServers method
            const allServers = server.getAllServers();
            if (allServers && allServers.size > 0) {
              allServers.forEach((s: any) => {
                const protocol = Helper.isString(s.options?.protocol) ? s.options.protocol : 
                               (Helper.isArray(s.options?.protocol) ? s.options.protocol[0] : '');
                if (protocol === 'grpc' && Helper.isFunction(s.RegisterService)) {
                  grpcServer = s;
                }
              });
            }
          } else if (Helper.isFunction(server?.RegisterService)) {
            // Single protocol gRPC server
            grpcServer = server;
          }
          
          // Register service to gRPC server
          if (grpcServer) {
            grpcServer.RegisterService({ service: si.service, implementation: impl });
            Logger.Debug(`Successfully registered gRPC service: ${si.name} with ${Object.keys(impl).length} handlers`);
          } else {
            Logger.Error(`Failed to find gRPC server instance for service registration: ${si.name}`);
          }
        } else {
          Logger.Warn(`Skip registering service ${si.name}: no matching controller handlers found`);
        }
      }
      
      // Protocol Isolation Note:
      // gRPC services are registered directly to the gRPC server instance,
      // not through Koa middleware chain, so protocol isolation is naturally enforced.
      // Only gRPC protocol requests will reach gRPC server.
      Logger.Debug('gRPC services registered (protocol-isolated by server instance)');
    } catch (err) {
      Logger.Error(err);
    }
  }

  /**
   * Cleanup all gRPC resources (for graceful shutdown)
   */
  public cleanup(): void {
    Logger.Info('Starting gRPC router cleanup...');

    // Close all active streams
    this.streamManager.closeAllStreams();

    // Flush pending batches
    this.batchProcessor.flush();

    // Clear connection pool
    this.connectionPool.clear();

    Logger.Info('gRPC router cleanup completed');
  }
}
