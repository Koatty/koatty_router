/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-03-12 14:54:42
 * @LastEditTime: 2025-03-14 18:15:15
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import KoaRouter from "@koa/router";
import fs from "fs";
import { graphqlHTTP } from "koa-graphql";
import { IOCContainer } from "koatty_container";
import {
  IGraphQLImplementation, Koatty, KoattyContext,
  KoattyRouter, RouterImplementation
} from "koatty_core";
import { buildSchema } from "koatty_graphql";
import { Helper } from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { payload } from "../params/payload";
import { Handler, injectParamMetaData, injectRouter } from "../utils/inject";
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
    const routeHandler = <IGraphQLImplementation>impl.implementation;
    if (Helper.isEmpty(routeHandler)) return;
    this.router.all(
      name,
      graphqlHTTP({
        schema: impl.schema,
        rootValue: routeHandler,
        graphiql: {
          headerEditorEnabled: true, // 启用请求头编辑器
        }
      }),
    );
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
      const schemaContent = fs.readFileSync(this.options.schemaFile, 'utf-8');
      const schema = buildSchema(schemaContent);

      const rootValue: IGraphQLImplementation = {};

      for (const n of list) {
        const ctlClass = IOCContainer.getClass(n, "CONTROLLER");
        // inject router
        const ctlRouters = injectRouter(app, ctlClass);
        if (!ctlRouters) {
          continue;
        }
        // inject param
        const ctlParams = injectParamMetaData(app, ctlClass, this.options.payload);
        // tslint:disable-next-line: forin
        for (const router of Object.values(ctlRouters)) {
          const method = router.method;
          // const path = parsePath(router.path);
          // const requestMethod = <RequestMethod>router.requestMethod;
          const params = ctlParams[method];

          Logger.Debug(`Register request mapping: ${n}.${method}`);
          rootValue[method] = (args: any, ctx: KoattyContext): Promise<any> => {
            const ctl = IOCContainer.getInsByClass(ctlClass, [ctx]);
            return Handler(app, ctx, ctl, method, params, Object.values(args));
          }
        }
      }
      this.SetRouter("/graphql", {
        schema,
        implementation: rootValue
      });
      // exp: in middleware
      // app.Router.SetRouter('/xxx',  (ctx: Koa.KoattyContext): any => {...}, 'GET')
      app.use(this.router.routes()).use(this.router.allowedMethods());
    } catch (err) {
      Logger.Error(err);
    }
  }

}