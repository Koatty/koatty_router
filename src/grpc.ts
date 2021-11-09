/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:10:30
 * @LastEditTime: 2021-07-13 10:36:57
 */
import { Koatty } from "koatty_core";
import { RequestMethod, Router } from ".";

/**
 * GrpcRouter Options
 *
 * @export
 * @interface GrpcRouterOptions
 */
export interface GrpcRouterOptions {
    proto: string;
    keepCase: true;
    longs: string;
    enums: string;
    defaults: true;
    oneofs: true;
}

export class GrpcRouter implements Router {
    app: Koatty;
    options: any;
    router: any;

    constructor(app: Koatty, options?: GrpcRouterOptions) {
        this.app = app;
        this.options = {
            ...options
        };
    }

    /**
     * Set router
     *
     * @param {string} path
     * @param {RequestMethod} [method]
     * @memberof HttpRouter
     */
    SetRouter(path: string, func: Function, method?: RequestMethod) {
        // todo
        return;
    }

    /**
     * Loading router
     *
     * @memberof Router
     */
    LoadRouter(list: any[]) {
        // todo
        return;
    }

}