/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:16:44
 * @LastEditTime: 2021-11-18 13:46:56
 */

import { Koatty, KoattyRouter, KoattyRouterOptions, KoattyContext } from "koatty_core";
import { DefaultLogger as Logger } from "koatty_logger";
import { Handler, injectParam, injectRouter } from "../inject";
import { IOCContainer } from "koatty_container";
import koaCompose from "koa-compose";

/**
 * WebsocketRouter Options
 *
 * @export
 * @interface WebsocketRouterOptions
 */
export interface WebsocketRouterOptions extends KoattyRouterOptions {
    prefix: string;
}
// WsImplementation
export type WsImplementation = (request: any, data: any) => Promise<any>;

export class WebsocketRouter implements KoattyRouter {
    app: Koatty;
    options: WebsocketRouterOptions;
    router: Map<string, WsImplementation>;

    constructor(app: Koatty, options?: KoattyRouterOptions) {
        this.app = app;
        this.options = Object.assign({
            prefix: options.prefix
        }, options)
        this.router = new Map();
    }

    /**
     * SetRouter
     *
     * @param {string} method
     * @param {WsImplementation} func
     * @memberof WebsocketRouter
     */
    SetRouter(method: string, func: WsImplementation) {
        this.router.set(method, func);
    }

    /**
     * 
     *
     * @returns {*}  
     * @memberof WebsocketRouter
     */
    ListRouter() {
        return this.router;
    }

    /**
     *
     *
     * @param {any[]} list
     */
    LoadRouter(list: any[]) {
        try {
            const app = this.app;
            // tslint:disable-next-line: forin
            for (const n in list) {
                const ctl = IOCContainer.getClass(n, "CONTROLLER");
                // inject router
                const ctlRouters = injectRouter(app, ctl);
                // inject param
                const ctlParams = injectParam(app, ctl);
                // tslint:disable-next-line: forin
                for (const it in ctlRouters) {
                    const router = ctlRouters[it];
                    const method = router.method;
                    const params = ctlParams[method];
                    Logger.Debug(`Register request mapping: ["${ctlRouters[it].path}" => ${n}.${method}]`);
                    this.SetRouter(ctlRouters[it].path, (request: any, data: any) => {
                        return this.wrapWebSocketHandler(request, data, (ctx: KoattyContext) => {
                            return Handler(app, ctx, n, method, params);
                        });
                    });
                }
            }
        } catch (err) {
            Logger.Error(err);
        }
    }

    /**
     * Wrap websocket handler with other middleware.
     *
     * @private
     * @param {*} request
     * @param {*} data
     * @param {(ctx: KoattyContext) => any} reqHandler
     * @returns {*}  
     * @memberof WebsocketRouter
     */
    private async wrapWebSocketHandler(request: any, data: any, reqHandler: (ctx: KoattyContext) => any) {
        const context = this.app.createContext(request, data, "ws");
        const middlewares = [...this.app.middleware, reqHandler];
        return koaCompose(middlewares)(context);
    }
}