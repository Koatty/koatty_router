/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 18:48:14
 * @LastEditTime: 2021-11-12 15:13:08
 */
import { Koatty, KoattyRouter, KoattyRouterOptions } from "koatty_core";
import { GrpcRouter } from "./grpc/router";
import { HttpRouter } from "./http/router";
import { WebsocketRouter } from "./websocket/router";
import * as Helper from "koatty_lib";
// export
export const PARAM_KEY = 'PARAM_KEY';
export const CONTROLLER_ROUTER = 'CONTROLLER_ROUTER';
export const ROUTER_KEY = 'ROUTER_KEY';
export * from "./http/mapping";
export * from "./http/router";
export * from "./grpc/router";
export * from "./websocket/router";

/**
 * get instance of Router
 *
 * @export
 * @param {Koatty} app
 * @param {*} options
 * @returns {*}  
 */
export function NewRouter(app: Koatty, options: KoattyRouterOptions): KoattyRouter {
    let router;
    switch (options.protocol) {
        case "grpc":
            router = new GrpcRouter(app, options);
            break;
        case "ws":
        case "wss":
            router = new WebsocketRouter(app, options)
            break;
        case "http":
        case "https":
        case "http2":
        default:
            router = new HttpRouter(app, options);
    }
    Helper.define(app, "router", router);
    return router;
}