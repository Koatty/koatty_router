/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-12-09 12:02:29
 * @LastEditTime: 2024-01-15 13:02:38
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { KoattyContext } from "koatty_core";
import { injectParam } from "../utils/inject";
import { PayloadOptions, bodyParser, queryParser } from "./payload";

/**
 * Get request header.
 *
 * @export
 * @param {string} [name]
 * @returns
 */
export function Header(name?: string): ParameterDecorator {
  return injectParam((ctx: KoattyContext) => {
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
  return injectParam((ctx: KoattyContext) => {
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
  return injectParam((ctx: KoattyContext) => {
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
  return injectParam((ctx: KoattyContext, opt?: PayloadOptions) => {
    return bodyParser(ctx, opt).then((body: {
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
  return injectParam((ctx: KoattyContext, opt?: PayloadOptions) => {
    return bodyParser(ctx, opt).then((body: {
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
 * Get parsed body(form variable and file object).
 *
 * @export
 * @returns ex: {post: {...}, file: {...}}
 */
export function RequestBody(): ParameterDecorator {
  return injectParam((ctx: KoattyContext, opt?: PayloadOptions) => {
    return bodyParser(ctx, opt);
  }, "RequestBody");
}

/**
 * Alias of @RequestBody
 * @param {*}
 * @return {*}
 */
export const Body = RequestBody;

/**
 * Get parsed query-string and path variable(koa ctx.query and ctx.params),
 * and set as an object.
 * 
 * @export
 * @returns {ParameterDecorator}
 */
export function RequestParam(): ParameterDecorator {
  return injectParam((ctx: KoattyContext, opt?: PayloadOptions) => {
    return queryParser(ctx, opt)
  }, "RequestParam");
}

/**
 * Alias of @RequestParam
 * @param {*}
 * @return {*}
 */
export const Param = RequestParam;