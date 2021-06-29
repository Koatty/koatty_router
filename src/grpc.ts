/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:10:30
 * @LastEditTime: 2021-06-29 16:30:37
 */

import { Application } from "koatty_container";
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
    app: Application;
    options: any;
    router: any;

    constructor(app: Application, options?: GrpcRouterOptions) {
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
    LoadRouter() {
        // todo
        return;
    }

}