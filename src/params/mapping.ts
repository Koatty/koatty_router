/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2024-10-31 14:16:50
 * @LastEditTime: 2024-11-07 10:47:18
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

// tslint:disable-next-line: no-import-side-effect
import { IOCContainer } from 'koatty_container';
import "reflect-metadata";

// used for request mapping metadata
export const MAPPING_KEY = 'MAPPING_KEY';

/**
 * Koatty router options
 *
 * @export
 * @interface RouterOption
 */
export interface RouterOption {
  path?: string;
  requestMethod: string;
  routerName?: string;
  method: string;
}

/**
 * http request methods
 *
 * @export
 * @var RequestMethod
 */
export enum RequestMethod {
  "GET" = "get",
  "POST" = "post",
  "PUT" = "put",
  "DELETE" = "delete",
  "PATCH" = "patch",
  "ALL" = "all",
  "OPTIONS" = "options",
  "HEAD" = "head"
}

/**
 * Routes HTTP requests to the specified path.
 *
 * @param {string} [path="/"]
 * @param {RequestMethod} [reqMethod=RequestMethod.GET]
 * @param {{
 *         routerName?: string;
 *     }} [routerOptions={}]
 * @returns {*}  {MethodDecorator}
 */
export const RequestMapping = (
  path = "/",
  reqMethod: RequestMethod = RequestMethod.GET,
  routerOptions: {
    routerName?: string;
  } = {}
): MethodDecorator => {
  const routerName = routerOptions.routerName ?? "";
  return (target, key: string, descriptor: PropertyDescriptor) => {
    const targetType = IOCContainer.getType(target);
    if (targetType !== "CONTROLLER") {
      throw Error("RequestMapping decorator is only used in controllers class.");
    }
    // tslint:disable-next-line: no-object-literal-type-assertion
    IOCContainer.attachPropertyData(MAPPING_KEY, {
      path,
      requestMethod: reqMethod,
      routerName,
      method: key
    } as RouterOption, target, key);

    return descriptor;
  };
};

/**
 * Routes HTTP POST requests to the specified path.
 */
export const PostMapping = (path = "/", routerOptions?: RouterOption) => {
  return RequestMapping(path, RequestMethod.POST, routerOptions);
};

/**
 * Routes HTTP GET requests to the specified path.
 */
export const GetMapping = (path = "/", routerOptions?: RouterOption) => {
  return RequestMapping(path, RequestMethod.GET, routerOptions);
};

/**
 * Routes HTTP DELETE requests to the specified path.
 */
export const DeleteMapping = (path = "/", routerOptions?: RouterOption) => {
  return RequestMapping(path, RequestMethod.DELETE, routerOptions);
};
/**
 * Routes HTTP PUT requests to the specified path.
 */
export const PutMapping = (path = "/", routerOptions?: RouterOption) => {
  return RequestMapping(path, RequestMethod.PUT, routerOptions);
};

/**
 * Routes HTTP PATCH requests to the specified path.
 */
export const PatchMapping = (path = "/", routerOptions?: RouterOption) => {
  return RequestMapping(path, RequestMethod.PATCH, routerOptions);
};

/**
 * Routes HTTP OPTIONS requests to the specified path.
 */
export const OptionsMapping = (path = "/", routerOptions?: RouterOption) => {
  return RequestMapping(path, RequestMethod.OPTIONS, routerOptions);
};

/**
 * Routes HTTP HEAD requests to the specified path.
 */
export const HeadMapping = (path = "/", routerOptions?: RouterOption) => {
  return RequestMapping(path, RequestMethod.HEAD, routerOptions);
};
