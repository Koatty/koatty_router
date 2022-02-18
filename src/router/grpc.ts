/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:10:30
 * @LastEditTime: 2022-02-19 00:33:34
 */
import * as Helper from "koatty_lib";
import { IOCContainer } from "koatty_container";
import { ListServices, LoadProto } from "koatty_proto";
import { DefaultLogger as Logger } from "koatty_logger";
import { Handler, injectParam, injectRouter } from "../inject";
import { ServiceDefinition, UntypedHandleCall, UntypedServiceImplementation } from "@grpc/grpc-js";
import { Koatty, KoattyRouter, KoattyRouterOptions, IRpcServerUnaryCall, IRpcServerCallback } from "koatty_core";

/**
 * GrpcRouter Options
 *
 * @export
 * @interface GrpcRouterOptions
 */
export interface GrpcRouterOptions extends KoattyRouterOptions {
    protoFile: string;
}

/**
 * ServiceImplementation
 *
 * @export
 * @interface ServiceImplementation
 */
export interface ServiceImplementation {
    service: ServiceDefinition;
    implementation: Implementation;
}
/**
 * Implementation
 *
 * @export
 * @interface Implementation
 */
export interface Implementation {
    [methodName: string]: UntypedHandleCall;
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
    params: any;
}

export class GrpcRouter implements KoattyRouter {
    app: Koatty;
    options: GrpcRouterOptions;
    router: Map<string, ServiceImplementation>;

    constructor(app: Koatty, options?: KoattyRouterOptions) {
        this.app = app;
        options.ext = options.ext || {};
        this.options = {
            ...options,
            protoFile: options.ext.protoFile,
        };
        this.router = new Map();
    }

    /** 
     * SetRouter
     *
     * @param {string} name
     * @param {ServiceDefinition<UntypedServiceImplementation>} service
     * @param {UntypedServiceImplementation} implementation
     * @returns {*}  
     * @memberof GrpcRouter
     */
    SetRouter(name: string, service: any, implementation: UntypedServiceImplementation) {
        if (Helper.isEmpty(name)) {
            return;
        }
        const value = {
            service: service,
            implementation: implementation
        }
        this.router.set(name, value);
    }

    /**
     * ListRouter
     *
     * @returns {*}  {ServiceImplementation[]}
     * @memberof GrpcRouter
     */
    ListRouter(): Map<string, ServiceImplementation> {
        return this.router;
    }

    /**
     * Loading router
     *
     * @memberof Router
     */
    async LoadRouter(list: any[]) {
        try {
            const app = this.app;
            // load proto files
            const pdef = LoadProto(this.options.protoFile);
            const services = ListServices(pdef);

            const ctls: CtlInterface = {};
            for (const n in list) {
                const ctlClass = IOCContainer.getClass(n, "CONTROLLER");
                // inject router
                const ctlRouters = injectRouter(app, ctlClass);
                // inject param
                const ctlParams = injectParam(app, ctlClass);

                for (const it in ctlRouters) {
                    const router = ctlRouters[it];
                    const method = router.method;
                    const path = router.path;
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
                    return;
                }
                const impl: { [key: string]: UntypedHandleCall } = {};
                for (const handler of si.handlers) {
                    const path = handler.path;
                    if (ctls[path]) {
                        const ctlItem = ctls[path];
                        Logger.Debug(`Register request mapping: ["${path}" => ${ctlItem.name}.${ctlItem.method}]`);
                        impl[handler.name] = (call: IRpcServerUnaryCall<any, any>, callback: IRpcServerCallback<any>) => {
                            return app.callback("grpc", (ctx) => {
                                const ctl = IOCContainer.getInsByClass(ctlItem.ctl, [ctx]);
                                return Handler(app, ctx, ctl, ctlItem.method, ctlItem.params);
                            })(call, callback);
                        }
                    }
                }
                this.SetRouter(serviceName, si.service, impl);
            }

        } catch (err) {
            Logger.Error(err);
        }
    }

}