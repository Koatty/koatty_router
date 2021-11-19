/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-17 17:36:13
 * @LastEditTime: 2021-11-19 16:50:37
 */

import { KoattyContext } from "koatty_core";
import { Inject } from "../inject";

/**
 * Get request header.
 *
 * @export
 * @param {string} [name]
 * @returns
 */
export function Header(name?: string): ParameterDecorator {
    return Inject((ctx: KoattyContext) => {
        if (name !== undefined) {
            return ctx.get(name);
        }
        return ctx.headers;
    }, "Header");
}

/**
 * Get path variable (take value from ctx.params).
 *
 * @export
 * @param {string} [name] params name
 * @returns
 */
export function PathVariable(name?: string): ParameterDecorator {
    return Inject((ctx: KoattyContext) => {
        const pathParams: any = ctx.params ?? {};
        if (name === undefined) {
            return pathParams;
        }
        return pathParams[name];
    }, "PathVariable");
}

/**
 * Get query-string parameters (take value from ctx.query).
 *
 * @export
 * @param {string} [name]
 * @returns
 */
export function Get(name?: string): ParameterDecorator {
    return Inject((ctx: KoattyContext) => {
        const queryParams: any = ctx.query ?? {};
        if (name === undefined) {
            return queryParams;
        }
        return queryParams[name];
    }, "Get");
}

/**
 * Get parsed POST/PUT... body.
 *
 * @export
 * @param {string} [name]
 * @returns
 */
export function Post(name?: string): ParameterDecorator {
    return Inject((ctx: KoattyContext) => {
        return ctx.bodyParser().then((body: {
            post: Object
        }) => {
            const params: any = body.post ? body.post : body;
            if (name === undefined) {
                return params;
            }
            return params[name];
        });
    }, "Post");
}

/**
 * Get parsed upload file object.
 *
 * @export
 * @param {string} [name]
 * @returns
 */
export function File(name?: string): ParameterDecorator {
    return Inject((ctx: KoattyContext) => {
        return ctx.bodyParser().then((body: {
            file: Object
        }) => {
            const params: any = body.file ?? {};
            if (name === undefined) {
                return params;
            }
            return params[name];
        });
    }, "File");
}


/**
 * Get request body (contains the values of @Post and @File).
 *
 * @export
 * @returns
 */
export function RequestBody(): ParameterDecorator {
    return Inject((ctx: KoattyContext) => {
        return ctx.bodyParser();
    }, "RequestBody");
}

/**
 * Get POST/GET parameters, POST priority
 *
 * @export
 * @param {string} [name]
 * @returns {ParameterDecorator}
 */
export function RequestParam(name?: string): ParameterDecorator {
    return Inject((ctx: KoattyContext) => {
        return ctx.bodyParser().then((body: {
            post: Object
        }) => {
            const queryParams: any = ctx.queryParser() ?? {};
            const postParams: any = (body.post ? body.post : body) ?? {};
            if (name !== undefined) {
                return postParams[name] === undefined ? queryParams[name] : postParams[name];
            }
            return { ...queryParams, ...postParams };
        });
    }, "RequestParam");
}