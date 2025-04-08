/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:16:44
 * @LastEditTime: 2025-03-15 16:35:45
 */

import KoaRouter from "@koa/router";
import { IOCContainer } from "koatty_container";
import {
  Koatty, KoattyContext, KoattyRouter,
  RouterImplementation
} from "koatty_core";
import { Helper } from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { RequestMethod } from "../params/mapping";
import { injectParamMetaData, injectRouter } from "../utils/inject";
import { Handler } from "../utils/handler";
import { parsePath } from "../utils/path";
import { RouterOptions } from "./router";

/**
 * WebsocketRouter Options
 *
 * @export
 * @interface WebsocketRouterOptions
 */
export interface WebsocketRouterOptions extends RouterOptions {
  prefix: string;
  maxFrameSize?: number; // 最大分帧大小(字节)，默认1MB
  frameTimeout?: number; // 分帧处理超时(ms)，默认30秒
  heartbeatInterval?: number; // 心跳检测间隔(ms)，默认15秒
  heartbeatTimeout?: number; // 心跳超时时间(ms)，默认30秒
}

export class WebsocketRouter implements KoattyRouter {
  readonly protocol: string;
  options: WebsocketRouterOptions;
  router: KoaRouter;
  private routerMap: Map<string, RouterImplementation>;

  private frameBuffers: Map<string, Buffer[]>;

  constructor(app: Koatty, options?: WebsocketRouterOptions) {
    this.options = {
      ...options,
      prefix: options?.prefix || '',
      maxFrameSize: options?.maxFrameSize || 1024 * 1024,
      frameTimeout: options?.frameTimeout || 30000,
      heartbeatInterval: options?.heartbeatInterval || 15000,
      heartbeatTimeout: options?.heartbeatTimeout || 30000
    };
    // 参数验证
    if (this.options.heartbeatInterval >= this.options.heartbeatTimeout) {
      Logger.Warn('heartbeatInterval should be less than heartbeatTimeout');
    }
    this.router = new KoaRouter(this.options);
    this.routerMap = new Map();
    this.frameBuffers = new Map();
  }

  /**
   * Set router
   * @param name 
   * @param impl 
   * @returns 
   */
  SetRouter(name: string, impl?: RouterImplementation) {
    if (Helper.isEmpty(impl.path)) return;

    const routeHandler = <any>impl.implementation;
    this.router.get(impl.path, routeHandler);
    this.routerMap.set(name, impl);
  }

  /**
   * ListRouter
   *
   * @returns {*}  {Map<string, RouterImplementation> }
   */
  ListRouter(): Map<string, RouterImplementation> {
    return this.routerMap;
  }

  /**
   * LoadRouter
   *
   * @param {any[]} list
   */
  async LoadRouter(app: Koatty, list: any[]) {
    try {
      for (const n of list) {
        const ctlClass = IOCContainer.getClass(n, "CONTROLLER");
        // inject router
        const ctlRouters = injectRouter(app, ctlClass, this.options.protocol);
        if (!ctlRouters) {
          continue;
        }
        // inject param
        const ctlParams = injectParamMetaData(app, ctlClass, this.options.payload);

        for (const router of Object.values(ctlRouters)) {
          const method = router.method;
          const path = parsePath(router.path);
          const requestMethod = <RequestMethod>router.requestMethod;
          const params = ctlParams[method];
          // if (requestMethod === RequestMethod.GET || requestMethod === RequestMethod.ALL) {
          Logger.Debug(`Register request mapping: [${requestMethod}] : ["${path}" => ${n}.${method}]`);
          this.SetRouter(path, {
            path,
            method: requestMethod,
            implementation: (ctx: KoattyContext): Promise<any> => {
              const ctl = IOCContainer.getInsByClass(ctlClass, [ctx]);
              return this.websocketHandler(app, ctx, ctl, method, params, undefined, router.middleware);
            },
          });
          // }
        }
      }
      // exp: in middleware
      // app.Router.SetRouter('/xxx',  {path, method, implementation: (ctx: KoattyContext): Promise<any> => {
      //   ...
      // })
      app.use(this.router.routes()).use(this.router.allowedMethods());
    } catch (err) {
      Logger.Error(err);
    }
  }

  private websocketHandler(app: Koatty, ctx: KoattyContext, ctl: Function, method: string, params?: any, ctlParamsValue?: any, middlewares?: Function[]): Promise<any> {
    return new Promise((resolve) => {
      const socketId = ctx.socketId || ctx.requestId;
      this.frameBuffers.set(socketId, []);

      // 设置分片处理超时
      let frameTimeout: NodeJS.Timeout;
      const resetFrameTimeout = () => {
        clearTimeout(frameTimeout);
        frameTimeout = setTimeout(() => {
          this.frameBuffers.delete(socketId);
          resolve(new Error('Frame timeout'));
        }, this.options.frameTimeout);
      };

      // 设置基于ping/pong的心跳检测
      let heartbeatTimeout: NodeJS.Timeout;
      let isAlive = true; // 连接活跃状态

      // 收到pong响应时标记为活跃
      const onPong = () => {
        isAlive = true;
      };

      // 检查连接活跃状态
      const checkAlive = () => {
        if (!isAlive) {
          // 连接超时，终止连接
          clearTimeout(heartbeatTimeout);
          ctx.websocket.terminate();
          this.frameBuffers.delete(socketId);
          Logger.Debug(`Connection timeout: ${socketId}`);
          resolve(new Error('Connection timeout'));
          return;
        }
        // 发送ping并重置状态
        isAlive = false;
        ctx.websocket.ping();
        heartbeatTimeout = setTimeout(checkAlive, this.options.heartbeatInterval);
      };

      // 初始化心跳检测
      resetFrameTimeout();
      ctx.websocket.on('pong', onPong);
      // 启动首次心跳检测
      heartbeatTimeout = setTimeout(checkAlive, this.options.heartbeatInterval);


      ctx.websocket.on('message', (data: Buffer | string) => {
        // 收到消息时重置连接状态
        isAlive = true;
        ctx.websocket.ping();

        const chunkSize = this.options.maxFrameSize;
        const buffers = this.frameBuffers.get(socketId) || [];

        // 处理不同类型的数据
        let bufferData: Buffer;
        if (typeof data === 'string') {
          bufferData = Buffer.from(data);
        } else {
          bufferData = data;
        }

        // 处理分块
        if (bufferData.length > chunkSize) {
          for (let i = 0; i < bufferData.length; i += chunkSize) {
            const chunk = bufferData.slice(i, Math.min(i + chunkSize, bufferData.length));
            buffers.push(chunk);
          }
        } else {
          buffers.push(bufferData);
        }

        // 更新缓冲区
        this.frameBuffers.set(socketId, buffers);

        // 连接关闭时清理所有资源
        ctx.websocket.on('close', () => {
          clearTimeout(frameTimeout);
          clearTimeout(heartbeatTimeout);
          this.frameBuffers.delete(socketId);
          Logger.Debug(`Connection closed: ${socketId}`);
        });

        // 如果是最后一块，处理完整数据
        if (bufferData.length <= chunkSize || bufferData.length % chunkSize !== 0) {
          const fullMessage = Buffer.concat(buffers).toString('utf8');
          ctx.message = fullMessage;
          const result = Handler(app, ctx, ctl, method, params, ctlParamsValue, middlewares);
          this.frameBuffers.delete(socketId);
          resolve(result);
        }
      });

    });
  }

}
