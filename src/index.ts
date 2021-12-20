/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 18:48:14
 * @LastEditTime: 2021-12-20 23:56:51
 */
import { GrpcRouter } from "./grpc/router";
import { HttpRouter } from "./http/router";
import { WebsocketRouter } from "./websocket/router";
import { Koatty, KoattyRouter, KoattyRouterOptions } from "koatty_core";

// export
export const PARAM_KEY = 'PARAM_KEY';
export const CONTROLLER_ROUTER = 'CONTROLLER_ROUTER';
export const ROUTER_KEY = 'ROUTER_KEY';
export * from "./http/mapping";
export * from "./http/request";
export * from "./http/router";
export * from "./grpc/router";
export * from "./websocket/router";

/**
 * get instance of Router
 *
 * @export
 * @param {Koatty} app
 * @param {KoattyRouterOptions} options
 * @param {string} [protocol]
 * @returns {*}  {KoattyRouter}
 */
export function NewRouter(app: Koatty, options: KoattyRouterOptions, protocol?: string): KoattyRouter {
    let router;
    switch (protocol) {
        case "grpc":
            router = new GrpcRouter(app, options);
            break;
        case "ws":
        case "wss":
            router = new WebsocketRouter(app, options)
            break;
        default:
            router = new HttpRouter(app, options);
    }
    return router;
}