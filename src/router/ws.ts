/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:16:44
 * @LastEditTime: 2024-10-31 14:57:55
 */

import KoaRouter from "@koa/router";
import { RouterOptions } from "./router";
import { RequestMethod } from "../params/mapping";
import { IOCContainer } from "koatty_container";
import { DefaultLogger as Logger } from "koatty_logger";
import { Handler, injectParamMetaData, injectRouter } from "../utils/inject";
import {
  Koatty, KoattyContext, KoattyRouter,
  RouterImplementation
} from "koatty_core";
import { Helper } from "koatty_lib";
import { parsePath } from "../utils/path";
import { payload } from "../params/payload";

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
    // payload middleware
    app.use(payload(this.options.payload));
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
    const routerMethod: any = {
      get: () => this.router.get(impl.path, <any>impl.implementation),
      post: () => this.router.post(impl.path, <any>impl.implementation),
      put: () => this.router.put(impl.path, <any>impl.implementation),
      delete: () => this.router.delete(impl.path, <any>impl.implementation),
      patch: () => this.router.patch(impl.path, <any>impl.implementation),
      options: () => this.router.options(impl.path, <any>impl.implementation),
      head: () => this.router.head(impl.path, <any>impl.implementation),
      all: () => this.router.all(impl.path, <any>impl.implementation)
    };
    if (routerMethod[method]) {
      routerMethod[method]();
    } else {
      routerMethod.all();
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
