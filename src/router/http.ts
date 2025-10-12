/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 19:02:06
 * @LastEditTime: 2025-03-15 16:35:13
 */
import KoaRouter from "@koa/router";
import { IOC } from "koatty_container";
import {
  Koatty, KoattyContext, KoattyRouter,
  RouterImplementation
} from "koatty_core";
import * as Helper from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { RequestMethod } from "../params/mapping";
import { injectParamMetaData, injectRouter } from "../utils/inject";
import { parsePath } from "../utils/path";
import { RouterOptions } from "./router";
import { Handler } from "../utils/handler";


/**
 * HttpRouter class
 */
export class HttpRouter implements KoattyRouter {
  readonly protocol: string;
  options: RouterOptions;
  router: KoaRouter;
  private routerMap: Map<string, RouterImplementation>;

  constructor(app: Koatty, options: RouterOptions = { protocol: "http", prefix: "" }) {
    this.options = { ...options };
    this.protocol = options.protocol || "http";
    
    // initialize
    this.router = new KoaRouter(this.options);
    this.routerMap = new Map();
  }

  /**
   * Set router
   * @param name 
   * @param impl 
   * @returns 
   */
  SetRouter(name: string, impl?: RouterImplementation) {
    if (Helper.isEmpty(impl.path)) return;

    const method = (impl.method || "").toLowerCase();
    const routeHandler = <any>impl.implementation;
    if (["get", "post", "put", "delete", "patch", "options", "head"].includes(method)) {
      (<any>this.router)[method](impl.path, routeHandler);
    } else {
      this.router.all(impl.path, routeHandler);
    }
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
        const ctlClass = IOC.getClass(n, "CONTROLLER");
        // inject router
        const ctlRouters = await injectRouter(app, ctlClass, this.options.protocol);
        if (!ctlRouters) {
          continue;
        }
        // inject param
        const ctlParams = injectParamMetaData(app, ctlClass, this.options.payload);
        // tslint:disable-next-line: forin
        for (const router of Object.values(ctlRouters)) {
          const method = router.method;
          const path = parsePath(router.path);
          const requestMethod = <RequestMethod>router.requestMethod;
          const params = ctlParams[method];

          Logger.Debug(`Register request mapping: ["${path}" => ${n}.${method}]`);
          this.SetRouter(path, {
            path,
            method: requestMethod,
            implementation: (ctx: KoattyContext): Promise<any> => {
              const ctl = IOC.getInsByClass(ctlClass, [ctx]);
              return Handler(app, ctx, ctl, method, params, undefined, router.composedMiddleware);
            },
          });
        }
      }
      // exp: in middleware
      // app.Router.SetRouter('/xxx',  (ctx: Koa.KoattyContext): any => {...}, 'GET')
      
      // CRITICAL FIX: Wrap router middleware to only handle HTTP protocols
      // In multi-protocol environment, all protocols share the same app instance
      // We need to ensure HTTP router only processes HTTP/HTTPS/HTTP2 requests
      const httpProtocols = new Set(['http', 'https', 'http2']);
      const routerMiddleware = this.router.routes();
      const allowedMethodsMiddleware = this.router.allowedMethods();
      
      // Wrap the router middleware with protocol check
      app.use(async (ctx: KoattyContext, next: any) => {
        // Only process if it's an HTTP protocol request
        if (httpProtocols.has(ctx.protocol)) {
          return routerMiddleware(ctx as any, next);
        }
        // Skip router for non-HTTP protocols (gRPC, WebSocket, etc.)
        return next();
      });
      
      // Wrap allowed methods middleware with protocol check
      app.use(async (ctx: KoattyContext, next: any) => {
        // Only process if it's an HTTP protocol request
        if (httpProtocols.has(ctx.protocol)) {
          return allowedMethodsMiddleware(ctx as any, next);
        }
        // Skip for non-HTTP protocols
        return next();
      });
    } catch (err) {
      Logger.Error(err);
    }
  }

  /**
   * Cleanup router resources (for graceful shutdown)
   * HTTP router is stateless, this method is for interface consistency
   */
  public cleanup(): void {
    Logger.Debug('HTTP router cleanup completed (stateless)');
  }
}
