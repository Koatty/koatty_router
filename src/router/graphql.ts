/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-03-12 14:54:42
 * @LastEditTime: 2025-03-12 15:02:43
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import KoaRouter from "@koa/router";
import { Koatty, KoattyRouter, RouterImplementation } from "koatty_core";
import { Helper } from "koatty_lib";
import { buildSchema } from "module";
import { payload } from "../params/payload";
import { ParamMetadata } from "../utils/inject";
import { RouterOptions } from "./router";

/**
 * GrpcRouter Options
 *
 * @export
 * @interface GraphQLRouterOptions
 */
export interface GraphQLRouterOptions extends RouterOptions {
  schemaFile: string;
}

/**
 * CtlInterface
 *
 * @interface CtlInterface
 */
interface CtlInterface {
  [path: string]: CtlProperty
}
/**
 * CtlProperty
 *
 * @interface CtlProperty
 */
interface CtlProperty {
  name: string;
  ctl: Function;
  method: string;
  params: ParamMetadata[];
}

export class GraphQLRouter implements KoattyRouter {
  readonly protocol: string;
  options: GraphQLRouterOptions;
  router: KoaRouter;
  private routerMap: Map<string, RouterImplementation>;

  constructor(app: Koatty, options?: RouterOptions) {
    options.ext = options.ext || {};
    this.options = {
      ...options,
      schemaFile: options.ext.schemaFile,
    };
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
    if (["get", "post", "put", "delete", "patch"].includes(method)) {
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
      // load schema files
      const schema = buildSchema(this.options.schemaFile);

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