/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:16:44
 * @LastEditTime: 2021-06-29 16:35:26
 */

import { Application } from "koatty_container";
import { RequestMethod, Router } from ".";

/**
 * WebsocketRouter Options
 *
 * @export
 * @interface WebsocketRouterOptions
 */
export interface WebsocketRouterOptions {
    port: 8080;
    //     perMessageDeflate: {
    //         zlibDeflateOptions: {
    //             // See zlib defaults.
    //             chunkSize: 1024,
    //             memLevel: 7,
    //             level: 3
    //         },
    //         zlibInflateOptions: {
    //             chunkSize: 10 * 1024
    //     },
    // // Other options settable:
    // clientNoContextTakeover: true, // Defaults to negotiated value.
    //     serverNoContextTakeover: true, // Defaults to negotiated value.
    //         serverMaxWindowBits: 10, // Defaults to negotiated value.
    //             // Below options specified as default values.
    //             concurrencyLimit: 10, // Limits zlib concurrency for perf.
    //                 threshold: 1024 // Size (in bytes) below which messages
    //     // should not be compressed.
    //   }
}

export class WebsocketRouter implements Router {
    app: Application;
    options: any;
    router: any;

    constructor(app: Application, options?: WebsocketRouterOptions) {
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