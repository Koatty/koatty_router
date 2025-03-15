/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:10:30
 * @LastEditTime: 2025-03-14 15:09:42
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
import { detectServer, Handler, injectParamMetaData, injectRouter, ParamMetadata } from "../utils/inject";
import { parsePath } from "../utils/path";
import { RouterOptions } from "./router";

/**
 * GrpcRouter Options
 *
 * @export
 * @interface GrpcRouterOptions
 */
export interface GrpcRouterOptions extends RouterOptions {
  protoFile: string;
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

export class GrpcRouter implements KoattyRouter {
  readonly protocol: string;
  options: GrpcRouterOptions;
  router: Map<string, RouterImplementation>;

  constructor(app: Koatty, options?: RouterOptions) {
    options.ext = options.ext || {};
    this.options = {
      ...options,
      protoFile: options.ext.protoFile,
    };
    this.router = new Map();
  }

  /**
   * SetRouter
   * @param name 
   * @param impl 
   * @returns 
   */
  SetRouter(name: string, impl?: RouterImplementation) {
    if (Helper.isEmpty(name)) {
      return;
    }
    this.router.set(name, {
      service: impl.service,
      implementation: impl.implementation
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
   * LoadRouter
   *
   * @memberof Router
   */
  async LoadRouter(app: Koatty, list: any[]) {
    try {
      // load proto files
      const pdef = LoadProto(this.options.protoFile);
      const services = ListServices(pdef);

      const ctls: CtlInterface = {};
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
          const { method, path } = router;
          const params = ctlParams[method];

          ctls[path] = {
            name: n,
            ctl: ctlClass,
            method,
            params,
          }
        }
      }

      // 循环匹配服务绑定路由
      for (const si of services) {
        const serviceName = si.name;
        // Verifying
        if (!si.service || si.handlers.length === 0) {
          Logger.Warn('Ignore', serviceName, 'which is an empty service');
          continue;
        }
        const impl: { [key: string]: UntypedHandleCall } = {};
        for (const handler of si.handlers) {
          const path = parsePath(handler.path);
          if (ctls[path]) {
            const ctlItem = ctls[path];
            Logger.Debug(`Register request mapping: ["${path}" => ${ctlItem.name}.${ctlItem.method}]`);
            impl[handler.name] = (call: IRpcServerCall<any, any>, callback: IRpcServerCallback<any>) => {
              return app.callback("grpc", (ctx) => {
                const ctl = IOCContainer.getInsByClass(ctlItem.ctl, [ctx]);
                return Handler(app, ctx, ctl, ctlItem.method, ctlItem.params);
              })(call, callback);
            };
          }
        }
        // set router
        this.SetRouter(serviceName, { service: si.service, implementation: impl });
        // RegisterService
        const server = detectServer(app.server, "grpc");
        server?.RegisterService({ service: si.service, implementation: impl });
      }
    } catch (err) {
      Logger.Error(err);
    }
  }

}