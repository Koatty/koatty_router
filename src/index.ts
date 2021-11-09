/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 18:48:14
 * @LastEditTime: 2021-07-13 10:36:29
 */
import { Koatty } from "koatty_core";
import { GrpcRouter } from "./grpc";
import { RequestMethod } from "./reuest_mapping";
import { HttpRouter } from "./router";
import { WebsocketRouter } from "./websocket";

export const PARAM_KEY = 'PARAM_KEY';
export const CONTROLLER_ROUTER = 'CONTROLLER_ROUTER';
export const ROUTER_KEY = 'ROUTER_KEY';
// export
export * from "./reuest_mapping";

/**
 * Router interface
 *
 * @export
 * @interface Router
 */
export interface Router {
    app: Koatty;
    options: any;
    router: any;

    SetRouter: (path: string, func: Function, method?: RequestMethod) => void;
    LoadRouter: (list: any[]) => void;
}

/**
 *
 *
 * @export
 * @enum {number}
 */
enum SERVE_MODE {
    "HTTP" = "http",
    "HTTP2" = "http2",
    "WEBSOCKET" = "websocket",
    "RPC" = "rpc"
}

/**
 * get instance of Router
 *
 * @export
 * @param {string} mode
 * @param {Koatty} app
 * @param {*} options
 * @returns {*}  
 */
export function NewRouter(mode: string, app: Koatty, options: any): HttpRouter | GrpcRouter | WebsocketRouter {
    switch (mode) {
        case SERVE_MODE.RPC:
            return new GrpcRouter(app, options);
            break;
        case SERVE_MODE.WEBSOCKET:
            return new WebsocketRouter(app, options);
            break;
        default:
            return new HttpRouter(app, options);
            break;
    }
}