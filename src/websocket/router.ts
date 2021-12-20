/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 14:16:44
 * @LastEditTime: 2021-12-20 23:55:13
 */

import { WebSocket } from "ws";
import koaCompose from "koa-compose";
import { IOCContainer } from "koatty_container";
import { DefaultLogger as Logger } from "koatty_logger";
import { Handler, injectParam, injectRouter } from "../inject";
import { Koatty, KoattyRouter, KoattyRouterOptions, KoattyContext } from "koatty_core";

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
export type WsImplementation = (socket: WebSocket, request: any, data: any) => Promise<any>;

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
                const ctlClass = IOCContainer.getClass(n, "CONTROLLER");
                // inject router
                const ctlRouters = injectRouter(app, ctlClass);
                // inject param
                const ctlParams = injectParam(app, ctlClass);
                // tslint:disable-next-line: forin
                for (const it in ctlRouters) {
                    const router = ctlRouters[it];
                    const method = router.method;
                    const params = ctlParams[method];
                    Logger.Debug(`Register request mapping: ["${ctlRouters[it].path}" => ${n}.${method}]`);
                    this.SetRouter(ctlRouters[it].path, (socket: WebSocket, request: any, data: any) => {
                        request.data = data;
                        const context = app.createContext(request, socket, "ws");
                        const ctl = IOCContainer.getInsByClass(ctlClass, [context]);
                        return this.wrapHandler(context, (ctx: KoattyContext) => {
                            return Handler(app, ctx, ctl, method, params);
                        });
                    });
                }
            }
        } catch (err) {
            Logger.Error(err);
        }
    }

    /**
     * Wrap handler with other middleware.
     *
     * @private
     * @param {KoattyContext} context
     * @param {(ctx: KoattyContext) => Promise<any>} reqHandler
     * @returns {*}  
     * @memberof WebsocketRouter
     */
    private async wrapHandler(
        context: KoattyContext,
        reqHandler: (ctx: KoattyContext) => Promise<any>,
    ) {
        const middlewares = [...this.app.middleware, reqHandler];
        return koaCompose(middlewares)(context);
    }
}