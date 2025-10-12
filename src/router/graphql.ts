/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-03-12 14:54:42
 * @LastEditTime: 2025-03-15 17:06:54
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import KoaRouter from "@koa/router";
import fs from "fs";
import { graphqlHTTP } from "koa-graphql";
import { IOC } from "koatty_container";
import {
  IGraphQLImplementation, Koatty, KoattyContext,
  KoattyRouter, RouterImplementation
} from "koatty_core";
import { buildSchema } from "koatty_graphql";
import { Helper } from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { injectParamMetaData, injectRouter } from "../utils/inject";
import { RouterOptions } from "./router";
import { Handler } from "../utils/handler";
import { getProtocolConfig } from "./types";

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

  constructor(app: Koatty, options: RouterOptions = { protocol: "graphql", prefix: "" }) {
    const extConfig = getProtocolConfig('graphql', options.ext || {});
    
    this.options = {
      ...options,
      schemaFile: extConfig.schemaFile,
    } as GraphQLRouterOptions;
    
    this.protocol = options.protocol || "graphql";
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
          // const path = parsePath(router.path);
          // const requestMethod = <RequestMethod>router.requestMethod;
          const params = ctlParams[method];

          Logger.Debug(`Register request mapping: ${n}.${method}`);
          rootValue[method] = (args: any, ctx: KoattyContext): Promise<any> => {
            const ctl = IOC.getInsByClass(ctlClass, [ctx]);
            return Handler(app, ctx, ctl, method, params, Object.values(args), router.composedMiddleware);
          }
          this.SetRouter(router.ctlPath || "/graphql", {
            schema,
            implementation: rootValue
          });
        }
      }

      // exp: in middleware
      // app.Router.SetRouter('/xxx',  { schema, implementation: rootValue})
      
      // CRITICAL FIX: Wrap router middleware to only handle GraphQL protocol
      // In multi-protocol environment, all protocols share the same app instance
      // We need to ensure GraphQL router only processes GraphQL requests
      const routerMiddleware = this.router.routes();
      const allowedMethodsMiddleware = this.router.allowedMethods();
      
      // Wrap the router middleware with protocol check
      app.use(async (ctx: KoattyContext, next: any) => {
        // Only process if it's a GraphQL protocol request
        if (ctx.protocol === 'graphql') {
          return routerMiddleware(ctx as any, next);
        }
        // Skip router for non-GraphQL protocols
        return next();
      });
      
      // Wrap allowed methods middleware with protocol check
      app.use(async (ctx: KoattyContext, next: any) => {
        // Only process if it's a GraphQL protocol request
        if (ctx.protocol === 'graphql') {
          return allowedMethodsMiddleware(ctx as any, next);
        }
        // Skip for non-GraphQL protocols
        return next();
      });
    } catch (err) {
      Logger.Error(err);
    }
  }

  /**
   * Cleanup router resources (for graceful shutdown)
   * GraphQL router is relatively stateless, this method is for interface consistency
   */
  public cleanup(): void {
    Logger.Debug('GraphQL router cleanup completed');
  }

}