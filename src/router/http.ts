/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 19:02:06
 * @LastEditTime: 2024-11-28 14:05:32
 */
import KoaRouter from "@koa/router";
import { IOCContainer } from "koatty_container";
import {
  Koatty, KoattyContext, KoattyRouter,
  RouterImplementation
} from "koatty_core";
import * as Helper from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { RequestMethod } from "../params/mapping";
import { payload } from "../params/payload";
import { Handler, injectParamMetaData, injectRouter } from "../utils/inject";
import { parsePath } from "../utils/path";
import { RouterOptions } from "./router";


/**
 * HttpRouter class
 */
export class HttpRouter implements KoattyRouter {
  readonly protocol: string;
  options: RouterOptions;
  router: KoaRouter;
  private routerMap: Map<string, RouterImplementation>;

  constructor(app: Koatty, options?: RouterOptions) {
    this.options = { ...options };
    // initialize
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
        const ctlClass = IOCContainer.getClass(n, "CONTROLLER");
        // inject router
        const ctlRouters = injectRouter(app, ctlClass);
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
              const ctl = IOCContainer.getInsByClass(ctlClass, [ctx]);
              return Handler(app, ctx, ctl, method, params);
            },
          });
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
