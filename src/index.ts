/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 18:48:14
 * @LastEditTime: 2022-02-19 00:25:57
 */
import { GrpcRouter } from "./router/grpc";
import { HttpRouter } from "./router/http";
import { WebsocketRouter } from "./router/websocket";
import { Koatty, KoattyRouter, KoattyRouterOptions } from "koatty_core";

// export
export * from "./mapping";
export * from "./request";
export * from "./router/http";
export * from "./router/grpc";
export * from "./router/websocket";

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