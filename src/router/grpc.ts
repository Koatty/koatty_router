/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:10:30
 * @LastEditTime: 2025-04-06 22:56:00
 */
import { UntypedHandleCall } from "@grpc/grpc-js";
import { IOCContainer } from "koatty_container";
import {
  IRpcServerCall,
  IRpcServerCallback,
  Koatty, KoattyRouter,
  RouterImplementation
} from "koatty_core";
import * as Helper from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { ListServices, LoadProto } from "koatty_proto";
import { payload } from "../params/payload";
import { injectParamMetaData, injectRouter, ParamMetadata } from "../utils/inject";
import { parsePath } from "../utils/path";
import { RouterOptions } from "./router";
import { Handler } from "../utils/handler";

/**
 * GrpcRouter Options
 */
export interface GrpcRouterOptions extends RouterOptions {
  protoFile: string;
  poolSize?: number;
  batchSize?: number;
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
    middleware: Function[];
  }
}

export class GrpcRouter implements KoattyRouter {
  readonly protocol: string;
  options: GrpcRouterOptions;
  router: Map<string, RouterImplementation>;
  private connectionPool: GrpcConnectionPool;
  private batchProcessor: GrpcBatchProcessor;

  constructor(app: Koatty, options: RouterOptions = { protocol: "grpc", prefix: "" }) {
    const ext = options.ext || {};
    this.options = {
      ...options,
      protoFile: ext.protoFile,
      poolSize: ext.poolSize || 10,
      batchSize: ext.batchSize || 10
    };
    this.router = new Map();
    this.connectionPool = new GrpcConnectionPool(this.options.poolSize);
    this.batchProcessor = new GrpcBatchProcessor(this.options.batchSize);
    app.use(payload(this.options.payload));
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
   * Stream handler for gRPC
   */
  private handleStream(call: IRpcServerCall<any, any>, callback: IRpcServerCallback<any>, handler: Function) {
    const stream = call as any;
    if (stream.on) {
      stream.on('data', (data: any) => handler(data));
      stream.on('end', () => callback(null, {}));
      stream.on('error', (err: Error) => callback(err));

      // 如果是可写流，处理初始请求
      if (stream.request) {
        handler(stream.request);
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
        const ctlClass = IOCContainer.getClass(n, "CONTROLLER");
        const ctlRouters = injectRouter(app, ctlClass, this.options.protocol);
        if (!ctlRouters) continue;

        const ctlParams = injectParamMetaData(app, ctlClass, this.options.payload);
        for (const router of Object.values(ctlRouters)) {
          ctls[router.path] = {
            name: n,
            ctl: ctlClass,
            method: router.method,
            params: ctlParams[router.method],
            middleware: router.middleware
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
            if ('stream' in call) {
              return this.handleStream(call, callback, (data: any) => {
                app.callback("grpc", (ctx) => {
                  const ctl = IOCContainer.getInsByClass(ctlItem.ctl, [ctx]);
                  return Handler(app, ctx, ctl, ctlItem.method, ctlItem.params, undefined, ctlItem.middleware);
                })(data, callback);
              });
            }

            return app.callback("grpc", (ctx) => {
              const ctl = IOCContainer.getInsByClass(ctlItem.ctl, [ctx]);
              return Handler(app, ctx, ctl, ctlItem.method, ctlItem.params, undefined, ctlItem.middleware);
            })(call, callback);
          };
        }
        // exp: in middleware
        // app.Router.SetRouter('/xxx',  { service: si.service, implementation: {
        //   "SayHello": (call: IRpcServerCall<any, any>, callback: IRpcServerCallback<any>) => {
        //     return app.callback("grpc", (ctx) => {
        //       ...
        //     })(call, callback);
        //   }
        // }})
        this.SetRouter(si.name, { service: si.service, implementation: impl });
        app.server?.RegisterService({ service: si.service, implementation: impl });
      }
    } catch (err) {
      Logger.Error(err);
    }
  }
}
