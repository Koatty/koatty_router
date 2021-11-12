/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:16:44
 * @LastEditTime: 2021-11-12 14:55:08
 */

import { Koatty, KoattyRouterOptions } from "koatty_core";
import { HttpRouter } from "../http/router";

/**
 * WebsocketRouter Options
 *
 * @export
 * @interface WebsocketRouterOptions
 */
export interface WebsocketRouterOptions extends KoattyRouterOptions {
    prefix: string;
}

export class WebsocketRouter extends HttpRouter {
    app: Koatty;
    options: WebsocketRouterOptions;
    router: any;

    constructor(app: Koatty, options?: KoattyRouterOptions) {
        const opt: WebsocketRouterOptions = Object.assign({
            prefix: options.prefix
        }, options)
        super(app, opt);
    }
}