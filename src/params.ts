/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-24 23:21:26
 * @LastEditTime: 2021-12-22 01:03:57
 */
import { IOCContainer } from "koatty_container";
import { Koatty, KoattyContext } from "koatty_core";
import * as Helper from "koatty_lib";
import {
    ClassValidator, convertParamsType, checkParamsType, ValidatorFuncs, plainToClass
} from "koatty_validation";
import { ParamMetadata, ParamMetadataObject } from "./inject";

/**
 * Parameter binding assignment.
 *
 * @param {Koatty} app
 * @param {KoattyContext} ctx
 * @param {any[]} params
 * @returns
 */
export async function getParamter(app: Koatty, ctx: KoattyContext, params?: ParamMetadata[]) {
    //convert type
    params = params || <ParamMetadata[]>[];
    const props: any[] = params.map(async (v: ParamMetadata, k: number) => {
        let value: any = null;
        if (v.fn && Helper.isFunction(v.fn)) {
            value = await v.fn(ctx);
        }

        // check params
        return checkParams(app, value, {
            index: k,
            isDto: v.isDto,
            type: v.type,
            validRules: v.rule,
            dtoCheck: v.dtoCheck,
            dtoRule: v.dtoRule,
            clazz: v.clazz,
        });
    });
    return Promise.all(props);
}

/**
 *
 *
 * @interface ParamOptions
 */
interface ParamOptions {
    index: number;
    isDto: boolean;
    type: string;
    validRules: any[];
    dtoCheck: boolean;
    dtoRule: any;
    clazz: any;
}

/**
 * Parameter binding assignment and rule verification.
 * If the input parameter type is inconsistent with the calibration, 
 * it will cause the parameter type conversion
 *
 * @param {Koatty} app
 * @param {*} value
 * @param {ParamOptions} opt
 * @returns {*}  
 */
async function checkParams(app: Koatty, value: any, opt: ParamOptions) {
    if (opt.isDto) {
        // DTO class
        if (!opt.clazz) {
            opt.clazz = IOCContainer.getClass(opt.type, "COMPONENT");
        }
        if (opt.dtoCheck) {
            value = await ClassValidator.valid(opt.clazz, value, true);
        } else {
            value = plainToClass(opt.clazz, value, true);
        }
    } else {
        value = convertParamsType(value, opt.type);
        //@Valid()
        if (opt.validRules[opt.index]) {
            const { type, rule, message } = opt.validRules[opt.index];
            if (type && rule) {
                ValidatorFuncs(`${opt.index}`, value, type, rule, message, false);
            }
        }
    }
    return value;
}
