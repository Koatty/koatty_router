/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-10 16:58:57
 * @LastEditTime: 2021-12-23 00:43:51
 */
import * as Helper from "koatty_lib";
import { getParamter } from "./params";
import { Koatty, KoattyContext } from "koatty_core";
import { DefaultLogger as Logger } from "koatty_logger";
import { CONTROLLER_ROUTER, PARAM_KEY, ROUTER_KEY } from "./index";
import { getOriginMetadata, IOCContainer, RecursiveGetMetadata } from "koatty_container";
import { paramterTypes, PARAM_CHECK_KEY, PARAM_RULE_KEY, PARAM_TYPE_KEY } from "koatty_validation";


/**
 * Inject ParameterDecorator
 * @param fn 
 */
export const Inject = (fn: Function, name: string): ParameterDecorator => {
    return (target: Object, propertyKey: string, descriptor: number) => {
        const targetType = IOCContainer.getType(target);
        if (targetType !== "CONTROLLER") {
            throw Error(`${name} decorator is only used in controllers class.`);
        }
        // 获取成员类型
        // const type = Reflect.getMetadata("design:type", target, propertyKey);
        // 获取成员参数类型
        const paramTypes = Reflect.getMetadata("design:paramtypes", target, propertyKey);
        // 获取成员返回类型
        // const returnType = Reflect.getMetadata("design:returntype", target, propertyKey);
        // 获取所有元数据 key (由 TypeScript 注入)
        // const keys = Reflect.getMetadataKeys(target, propertyKey);
        let type = (paramTypes[descriptor] && paramTypes[descriptor].name) ? paramTypes[descriptor].name : "object";
        let isDto = false;
        //DTO class
        if (!(Helper.toString(type) in paramterTypes)) {
            type = IOCContainer.getIdentifier(paramTypes[descriptor]);
            // reg to IOC container
            // IOCContainer.reg(type, paramTypes[descriptor]);
            isDto = true;
        }

        IOCContainer.attachPropertyData(PARAM_KEY, {
            name: propertyKey,
            fn,
            index: descriptor,
            type,
            isDto
        }, target, propertyKey);
        return descriptor;

    };
};

// IHandler
export type IHandler = (app: Koatty, ctx: KoattyContext, ctl: any, method: string, ctlParams: any) => Promise<any>;
/**
 * controller handler
 *
 * @param {Koatty} app
 * @param {KoattyContext} ctx
 * @param {*} ctl
 * @param {*} method
 * @param {*} ctlParams
 * @returns
 */
export async function Handler(app: Koatty, ctx: KoattyContext, ctl: any, method: string, ctlParams: any) {
    if (!ctx || !ctl) {
        return ctx.throw(404, `Controller not found.`);
    }
    if (!ctl.ctx) {
        ctl.ctx = ctx;
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
 * @interface RouterMetadata
 */
interface RouterMetadata {
    method: string;
    path: string;
    requestMethod: string;
    routerName: string;
}

/**
 *
 *
 * @interface RouterMetadataObject
 */
interface RouterMetadataObject {
    [key: string]: RouterMetadata;
}

/**
 *
 *
 * @param {Koatty} app
 * @param {*} target
 * @param {*} [instance]
 * @returns {*} 
 */
export function injectRouter(app: Koatty, target: any, instance?: any): RouterMetadataObject {
    // Controller router path
    const metaDatas = IOCContainer.listPropertyData(CONTROLLER_ROUTER, target);
    let path = "";
    const identifier = IOCContainer.getIdentifier(target);
    if (metaDatas) {
        path = metaDatas[identifier] ?? "";
    }
    path = path.startsWith("/") || path === "" ? path : `/${path}`;

    const rmetaData = RecursiveGetMetadata(ROUTER_KEY, target);
    const router: RouterMetadataObject = {};
    // tslint:disable-next-line: forin
    for (const metaKey in rmetaData) {
        // Logger.Debug(`Register inject method Router key: ${metaKey} => value: ${JSON.stringify(rmetaData[metaKey])}`);
        //.sort((a, b) => b.priority - a.priority) 
        for (const val of rmetaData[metaKey]) {
            const tmp = {
                ...val,
                path: `${path}${val.path}`.replace("//", "/")
            };
            router[`${tmp.path}||${tmp.requestMethod}`] = tmp;
        }
    }

    return router;
}

/**
 *
 *
 * @interface ParamMetadata
 */
export interface ParamMetadata {
    "fn": any;
    "name": string;
    "index": number;
    "clazz": any;
    "type": string;
    "isDto": boolean;
    "rule": any;
    "dtoCheck": boolean;
    "dtoRule": any;
}

/**
 *
 *
 * @interface ParamMetadataObject
 */
export interface ParamMetadataObject {
    [key: string]: ParamMetadata[];
}

/**
 *
 *
 * @param {Koatty} app
 * @param {*} target
 * @param {*} [instance]
 * @returns {*} 
 */
export function injectParam(app: Koatty, target: any, instance?: any): ParamMetadataObject {
    instance = instance || target.prototype;
    const metaDatas = RecursiveGetMetadata(PARAM_KEY, target);
    const validMetaDatas = RecursiveGetMetadata(PARAM_RULE_KEY, target);
    const validatedMetaDatas = RecursiveGetMetadata(PARAM_CHECK_KEY, target);
    const argsMetaObj: ParamMetadataObject = {};
    for (const meta in metaDatas) {
        if (instance[meta] && instance[meta].length <= metaDatas[meta].length) {
            Logger.Debug(`Register inject param key ${IOCContainer.getIdentifier(target)}: ${Helper.toString(meta)} => value: ${JSON.stringify(metaDatas[meta])}`);

            // cover to obj
            const data = (metaDatas[meta] ?? []).sort((a: any, b: any) => a.index - b.index);
            const validData = validMetaDatas[meta] ?? [];
            data.forEach((v: any) => {
                v.rule = {};
                validData.forEach((it: any) => {
                    if (v.index === it.index) {
                        v.rule = it;
                    }
                });
                if (v.type) {
                    v.type = v.isDto ? v.type : (v.type).toLowerCase();
                }
                v.dtoCheck = (validatedMetaDatas[meta] && validatedMetaDatas[meta].dtoCheck) ? true : false;
                if (v.isDto) {
                    v.clazz = IOCContainer.getClass(v.type, "COMPONENT");
                    if (v.dtoCheck) {
                        v.dtoRule = {};
                        const originMap = getOriginMetadata(PARAM_TYPE_KEY, v.clazz);
                        for (const [key, type] of originMap) {
                            v.dtoRule[key] = type;
                        }
                        v.clazz.prototype["_typeDef"] = v.dtoRule;
                    }
                }
            });
            argsMetaObj[meta] = data;
        }
    }
    return argsMetaObj;
}

