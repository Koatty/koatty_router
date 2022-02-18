/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 19:02:06
 * @LastEditTime: 2022-02-19 00:19:14
 */
import KoaRouter from "@koa/router";
import * as Helper from "koatty_lib";
import { RequestMethod } from "../index";
import { IOCContainer } from "koatty_container";
import { DefaultLogger as Logger } from "koatty_logger";
import { Handler, injectParam, injectRouter } from "../inject";
import { Koatty, KoattyContext, KoattyRouter, KoattyRouterOptions } from "koatty_core";

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
                const ctlClass = IOCContainer.getClass(n, "CONTROLLER");
                // inject router
                const ctlRouters = injectRouter(app, ctlClass);
                // inject param
                const ctlParams = injectParam(app, ctlClass);
                // tslint:disable-next-line: forin
                for (const it in ctlRouters) {
                    const router = ctlRouters[it];
                    const method = router.method;
                    const path = router.path;
                    const requestMethod = router.requestMethod;
                    const params = ctlParams[method];
                    Logger.Debug(`Register request mapping: [${requestMethod}] : ["${path}" => ${n}.${method}]`);
                    kRouter[requestMethod](path, function (ctx: KoattyContext): Promise<any> {
                        const ctl = IOCContainer.getInsByClass(ctlClass, [ctx]);
                        return Handler(app, ctx, ctl, method, params);
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
