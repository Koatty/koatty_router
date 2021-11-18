/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 19:02:06
 * @LastEditTime: 2021-11-17 18:25:26
 */
import KoaRouter from "@koa/router";
import * as Helper from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { Koatty, KoattyContext, KoattyRouter, KoattyRouterOptions } from "koatty_core";
import { IOCContainer } from "koatty_container";
import { RequestMethod } from "../index";
import { Handler, injectParam, injectRouter } from "../inject";


/**
 * HttpRouter class
 */
export class HttpRouter implements KoattyRouter {
    app: Koatty;
    options: KoattyRouterOptions;
    router: KoaRouter<any, unknown>;

    constructor(app: Koatty, options?: KoattyRouterOptions) {
        this.app = app;
        this.options = {
            ...options
        };
        // initialize
        this.router = new KoaRouter(this.options);
    }

    /**
     * Set router
     *
     * @param {string} path
     * @param {RequestMethod} [method]
     */
    SetRouter(path: string, func: Function, method?: RequestMethod) {
        if (Helper.isEmpty(method)) {
            return;
        }
        this.router[method](path, <any>func);
    }

    /**
     *
     *
     * @param {any[]} list
     */
    LoadRouter(list: any[]) {
        try {
            const app = this.app;
            const kRouter: any = this.router;
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
                    Logger.Debug(`Register request mapping: [${ctlRouters[it].requestMethod}] : ["${ctlRouters[it].path}" => ${n}.${method}]`);
                    kRouter[ctlRouters[it].requestMethod](ctlRouters[it].path, function (ctx: KoattyContext): Promise<any> {
                        return Handler(app, ctx, n, method, params);
                    });
                }
            }

            // Load in the 'appStart' event to facilitate the expansion of middleware
            // exp: in middleware
            // app.Router.SetRouter('/xxx',  (ctx: Koa.KoattyContext): any => {...}, 'GET')
            app.on('appStart', () => {
                app.use(kRouter.routes()).use(kRouter.allowedMethods());
            });
        } catch (err) {
            Logger.Error(err);
        }
    }

}
