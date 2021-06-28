/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 18:48:14
 * @LastEditTime: 2021-06-28 19:25:10
 */
import { Koatty } from "koatty";
import { HttpRouter } from "./router";

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

    LoadRouter: () => void;
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
export function NewRouter(mode: string, app: Koatty, options: any) {
    switch (mode) {
        // case SERVE_MODE.RPC:
        //     break;
        // case SERVE_MODE.WEBSOCKET:
        //     break;
        default:
            return new HttpRouter(app, options);
            break;
    }
}