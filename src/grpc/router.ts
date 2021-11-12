/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:10:30
 * @LastEditTime: 2021-11-12 15:12:19
 */
import { IOCContainer } from "koatty_container";
import { Koatty, KoattyContext, KoattyRouter, KoattyRouterOptions } from "koatty_core";
import * as Helper from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { Handler, injectParam } from "../inject";
import { LoadProto, ProtoDef } from "./protobuf";

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
 *
 *
 * @export
 * @interface ServiceImplementation
 */
export interface ServiceImplementation {
    service: any;
    implementation: any;
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
     *
     *
     * @param {string} path
     * @param {Function} func
     * @param {ProtoDef} proto
     * @memberof GrpcRouter
     */
    SetRouter(path: string, func: Function, proto: ProtoDef) {
        if (Helper.isEmpty(path)) {
            return this.router;
        }
        const value: ServiceImplementation = {
            service: proto.service.service,
            implementation: {
                [path]: func,
            },
        }
        if (this.router.has(proto.name)) {
            const ex = this.router.get(proto.name);
            value.implementation = Object.assign(ex.implementation, value);
        }
        this.router.set(proto.name, value);
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
            const services = await LoadProto(this.options.protoFile);

            // tslint:disable-next-line: forin
            for (const n in list) {
                const ctl = IOCContainer.getClass(n, "CONTROLLER");
                // inject param
                const ctlParams = injectParam(app, ctl);
                for (const it of services) {
                    const serviceName = it.name;
                    if (n === `${serviceName}Controller`) {
                        // Verifying
                        if (!it.service || !it.service.hasOwnProperty('service') ||
                            Object.keys(it.service.service).length === 0) {
                            Logger.Warn('Ignore', it.name, 'which is an empty service');
                            return;
                        }
                        for (const method of Object.keys(it.service.service)) {
                            Logger.Debug(`Register request mapping: ["${it.path}" => ${n}.${method}]`);
                            const params = ctlParams[method];
                            this.SetRouter(it.path, function (ctx: KoattyContext): Promise<any> {
                                return Handler(app, ctx, n, method, params);
                            }, it);
                        }
                    }
                }
            }
        } catch (err) {
            Logger.Error(err);
        }
    }

}