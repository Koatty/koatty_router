/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-10 16:58:57
 * @LastEditTime: 2021-11-10 18:24:41
 */
import * as Helper from "koatty_lib";
import { IOCContainer, RecursiveGetMetadata } from "koatty_container";
import { Koatty, KoattyContext } from "koatty_core";
import { DefaultLogger as Logger } from "koatty_logger";
import { checkParams, PARAM_CHECK_KEY, PARAM_RULE_KEY } from "koatty_validation";
import { CONTROLLER_ROUTER, PARAM_KEY, ROUTER_KEY } from "./index";

/**
 * controller handler
 *
 * @param {Koatty} app
 * @param {KoattyContext} ctx
 * @param {string} identifier
 * @param {*} router
 * @param {*} ctlParams
 * @returns
 */
export async function Handler(app: Koatty, ctx: KoattyContext, identifier: string, method: string, ctlParams: any) {
    const ctl: any = IOCContainer.get(identifier, "CONTROLLER", [ctx]);

    // const ctl: any = container.get(identifier, "CONTROLLER");
    if (!ctx || !ctl || !ctl.init) {
        return ctx.throw(404, `Controller ${identifier} not found.`);
    }
    // inject param
    let args = [];
    if (ctlParams) {
        args = await getParamter(app, ctx, ctlParams);
    }
    // method
    return ctl[method](...args);
}

/**
 *
 *
 * @param {Koatty} app
 * @param {*} target
 * @param {*} [instance]
 * @returns {*} 
 */
export function injectRouter(app: Koatty, target: any, instance?: any) {
    // Controller router path
    const metaDatas = IOCContainer.listPropertyData(CONTROLLER_ROUTER, target);
    let path = "";
    const identifier = IOCContainer.getIdentifier(target);
    if (metaDatas) {
        path = metaDatas[identifier] ?? "";
    }
    path = path.startsWith("/") || path === "" ? path : `/${path}`;

    const rmetaData = RecursiveGetMetadata(ROUTER_KEY, target);
    const router: any = {};
    // tslint:disable-next-line: forin
    for (const metaKey in rmetaData) {
        Logger.Debug(`Register inject method Router key: ${metaKey} => value: ${JSON.stringify(rmetaData[metaKey])}`);
        //.sort((a, b) => b.priority - a.priority) 
        for (const val of rmetaData[metaKey]) {
            const tmp = {
                ...val,
                path: `${path}${val.path}`.replace("//", "/")
            };
            router[`${tmp.path}-${tmp.requestMethod}`] = tmp;
        }
    }

    return router;
}

/**
 *
 *
 * @param {Koatty} app
 * @param {*} target
 * @param {*} [instance]
 * @returns {*} 
 */
export function injectParam(app: Koatty, target: any, instance?: any) {
    instance = instance || target.prototype;
    const metaDatas = RecursiveGetMetadata(PARAM_KEY, target);
    const validMetaDatas = RecursiveGetMetadata(PARAM_RULE_KEY, target);
    const validatedMetaDatas = RecursiveGetMetadata(PARAM_CHECK_KEY, target);
    const argsMetaObj: any = {};
    for (const meta in metaDatas) {
        if (instance[meta] && instance[meta].length <= metaDatas[meta].length) {
            Logger.Debug(`Register inject ${IOCContainer.getIdentifier(target)} param key: ${Helper.toString(meta)} => value: ${JSON.stringify(metaDatas[meta])}`);

            // cover to obj
            const data = (metaDatas[meta] ?? []).sort((a: any, b: any) => a.index - b.index);
            const validData = validMetaDatas[meta] ?? [];
            const validMetaObj: any = {};
            data.forEach((v: any) => {
                validData.forEach((it: any) => {
                    if (v.index === it.index) {
                        validMetaObj[v.index] = it;
                    }
                });
            });
            argsMetaObj[meta] = {
                valids: validMetaObj,
                data,
                dtoCheck: (validatedMetaDatas[meta] && validatedMetaDatas[meta].dtoCheck) ? true : false
            };
        }
    }
    return argsMetaObj;
}


/**
 * Convert paramter types and valid check.
 *
 * @param {Koatty} app
 * @param {KoattyContext} ctx
 * @param {any[]} params
 * @returns
 */
async function getParamter(app: Koatty, ctx: KoattyContext, ctlParams: any = {}) {
    //convert type
    const params = ctlParams.data ?? [];
    const validRules = ctlParams.valids ?? {};
    const dtoCheck = ctlParams.dtoCheck || false;
    const props: any[] = params.map(async (v: any, k: number) => {
        let value: any = null;
        if (v.fn && Helper.isFunction(v.fn)) {
            value = await v.fn(ctx);
        }
        // check params
        return checkParams(value, {
            index: k,
            isDto: v.isDto,
            type: v.type,
            validRules,
            dtoCheck,
        });
    });
    return Promise.all(props);
}
