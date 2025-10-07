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
import { getProtocolConfig } from "./types";

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
   * Get connection from pool
   */
  get(serviceName: string): any | null {
    if (!this.pool.has(serviceName) || this.pool.get(serviceName)?.length === 0) {
      return null;
    }
    return this.pool.get(serviceName)?.pop();
  }

  /**
   * Release connection back to pool
   */
  release(serviceName: string, connection: any): void {
    if (!this.pool.has(serviceName)) {
      this.pool.set(serviceName, []);
    }
    if (this.pool.get(serviceName)?.length < this.maxSize) {
      this.pool.get(serviceName)?.push(connection);
    }
  }

  /**
   * Create new connection
   */
  private create(_serviceName: string, _options: any): any {
    // Implementation depends on your gRPC client library
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

    clearTimeout(this.batchTimers.get(serviceName)!);
    this.batchTimers.delete(serviceName);
    // Process batch here
    // This would call the actual gRPC batch endpoint
    // Then resolve/reject each promise in the queue

    this.batchQueue.delete(serviceName);
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

        const ctlParams = injectParamMetaData(app, ctlClass, this.options.payload);
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
        
        this.SetRouter(si.name, { service: si.service, implementation: impl });
        app.server?.RegisterService({ service: si.service, implementation: impl });
      }
    } catch (err) {
      Logger.Error(err);
    }
  }
}
