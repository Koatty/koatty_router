/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:10:30
 * @LastEditTime: 2021-11-18 17:42:10
 */
import { IOCContainer } from "koatty_container";
import { Koatty, KoattyRouter, KoattyRouterOptions, IRpcServerUnaryCall, IRpcServerCallback, CreateGrpcContext, KoattyContext } from "koatty_core";
import * as Helper from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { Handler, injectParam } from "../inject";
import { LoadProto, ProtoDef } from "./protobuf";
import koaCompose from "koa-compose";
import { ServiceDefinition, UntypedHandleCall, UntypedServiceImplementation } from "@grpc/grpc-js";

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
            const services = LoadProto(this.options.protoFile);

            // tslint:disable-next-line: forin
            for (const n in list) {
                const ctl = IOCContainer.getClass(n, "CONTROLLER");
                // inject param
                const ctlParams = injectParam(app, ctl);
                for (const it of services) {
                    const serviceName = it.name;
                    if (n === `${serviceName}Controller`) {
                        // Verifying
                        if (!it.service || it.handlers.length === 0) {
                            Logger.Warn('Ignore', it.name, 'which is an empty service');
                            return;
                        }
                        const impl: { [key: string]: UntypedHandleCall } = {};
                        for (const handler of it.handlers) {
                            const method = handler.name;
                            Logger.Debug(`Register request mapping: ["${it.name}" => ${n}.${method}]`);
                            const params = ctlParams[method];

                            impl[handler.name] = (call: IRpcServerUnaryCall<any, any>, callback: IRpcServerCallback<any>) => {
                                return this.wrapGrpcHandler(call, callback, (ctx: KoattyContext) => {
                                    return Handler(app, ctx, n, method, params);
                                });
                            }
                            this.SetRouter(it.name, it.service, impl);
                        }
                    }
                }
            }
        } catch (err) {
            Logger.Error(err);
        }
    }

    /**
     * Wrap gRPC handler with other middleware.
     *
     * @private
     * @param {IRpcServerUnaryCall<any, any>} call
     * @param {IRpcServerCallback<any>} callback
     * @param {(ctx: KoattyContext) => any} reqHandler
     * @memberof GrpcRouter
     */
    private async wrapGrpcHandler(call: IRpcServerUnaryCall<any, any>, callback: IRpcServerCallback<any>, reqHandler: (ctx: KoattyContext) => any) {
        const context = this.app.createContext(call, call, "grpc");
        const middlewares = [...this.app.middleware, reqHandler];
        const res = await koaCompose(middlewares)(context);
        callback(null, res)
    }

}