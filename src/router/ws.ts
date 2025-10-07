/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:16:44
 * @LastEditTime: 2024-11-29 17:10:11
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
import { Handler, injectParamMetaData, injectRouter } from "../utils/inject";
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
}

export class WebsocketRouter implements KoattyRouter {
  readonly protocol: string;
  options: WebsocketRouterOptions;
  router: KoaRouter;
  private routerMap: Map<string, RouterImplementation>;

  constructor(app: Koatty, options?: RouterOptions) {
    this.options = { ...options, prefix: options.prefix };
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
        const ctlRouters = injectRouter(app, ctlClass);
        // inject param
        const ctlParams = injectParamMetaData(app, ctlClass, this.options.payload);

        for (const router of Object.values(ctlRouters)) {
          const method = router.method;
          const path = parsePath(router.path);
          const requestMethod = <RequestMethod>router.requestMethod;
          const params = ctlParams[method];
          if (requestMethod === RequestMethod.GET || requestMethod === RequestMethod.ALL) {
            Logger.Debug(`Register request mapping: [${requestMethod}] : ["${path}" => ${n}.${method}]`);
            this.SetRouter(path, {
              path,
              method: requestMethod,
              implementation: (ctx: KoattyContext): Promise<any> => {
                const ctl = IOCContainer.getInsByClass(ctlClass, [ctx]);
                return Handler(app, ctx, ctl, method, params);
              },
            });
          }
        }
      }
      // exp: in middleware
      // app.Router.SetRouter('/xxx',  (ctx: Koa.KoattyContext): any => {...}, 'GET')
      app.use(this.router.routes()).use(this.router.allowedMethods());
    } catch (err) {
      Logger.Error(err);
    }
  }

}
