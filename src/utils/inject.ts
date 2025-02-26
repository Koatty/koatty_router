/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-12-09 12:02:29
 * @LastEditTime: 2025-02-26 18:34:18
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import {
  getOriginMetadata, IOC, IOCContainer, recursiveGetMetadata,
  TAGGED_PARAM
} from "koatty_container";
import { CONTROLLER_ROUTER, Koatty, KoattyContext, KoattyServer } from "koatty_core";
import { Exception } from "koatty_exception";
import { Helper } from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import {
  ClassValidator,
  convertParamsType,
  FunctionValidator,
  PARAM_CHECK_KEY, PARAM_RULE_KEY, PARAM_TYPE_KEY,
  paramterTypes,
  plainToClass,
  ValidOtpions,
  ValidRules
} from "koatty_validation";
import { Project } from "ts-morph";
import { MAPPING_KEY } from "../params/mapping";
import { PayloadOptions } from "../params/payload";

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
export async function Handler(app: Koatty, ctx: KoattyContext, ctl: any,
  method: string, ctlParams?: ParamMetadata[]) {
  if (!ctx || !ctl) {
    return ctx.throw(404, `Controller not found.`);
  }
  ctl.ctx ??= ctx;
  // inject param
  const args = ctlParams ? await getParameter(app, ctx, ctlParams) : [];
  // method
  const res = await ctl[method](...args);
  if (Helper.isError(res)) {
    throw res;
  }
  ctx.body = ctx.body || res;
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
 * @param {string} [protocol]
 * @returns {*} 
 */
export function injectRouter(app: Koatty, target: any, protocol = 'http'): RouterMetadataObject {
  // Controller router path
  const metaDatas = IOCContainer.listPropertyData(CONTROLLER_ROUTER, target);
  const ctlName = IOCContainer.getIdentifier(target);
  const options = (metaDatas && ctlName in metaDatas) ?
    metaDatas[IOCContainer.getIdentifier(target)] : { path: "", protocol: 'http' };
  options.path = options.path.startsWith("/") || options.path === "" ? options.path : `/${options.path}`;
  options.protocol = options.protocol || 'http';

  const rmetaData = recursiveGetMetadata(IOC, MAPPING_KEY, target);
  const router: RouterMetadataObject = {};
  const methods: string[] = [];
  if (app.appDebug) {
    const ctlPath = getControllerPath(ctlName);
    methods.push(...getPublicMethods(ctlPath, ctlName));
  }

  // protocol check
  if (options.protocol.includes(protocol)) {
    // tslint:disable-next-line: forin
    for (const metaKey in rmetaData) {
      // Logger.Debug(`Register inject method Router key: ${metaKey} =>
      // value: ${ JSON.stringify(rmetaData[metaKey]) }`);
      //.sort((a, b) => b.priority - a.priority) 
      if (app.appDebug && !methods.includes(metaKey)) {
        Logger.Debug(`The method ${metaKey} is bound to the route, but the scope of this method is not public.`);
        continue;
      }
      for (const val of rmetaData[metaKey]) {
        const tmp = {
          ...val,
          path: `${options.path}${val.path}`.replace("//", "/")
        };
        router[`${tmp.path}||${tmp.requestMethod}`] = tmp;
      }
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
  "fn": Function;
  "name": string;
  "index": number;
  "clazz": any;
  "type": string;
  "isDto": boolean;
  "validRule": Function | ValidRules | ValidRules[];
  "validOpt": ValidOtpions;
  "options": PayloadOptions;
  "dtoCheck": boolean;
  "dtoRule": Map<string, string>;
}

/**
 *
 *
 * @interface ParamMetadataMap
 */
interface ParamMetadataMap {
  [key: string]: ParamMetadata[];
}

/**
 * injectParamMetaData
 *
 * @param {Koatty} app
 * @param {*} target
 * @param {*} [options]
 * @returns {*} 
 */
export function injectParamMetaData(app: Koatty, target: any,
  options?: PayloadOptions): ParamMetadataMap {
  // const instance = target.prototype;
  const metaDatas = recursiveGetMetadata(IOC, TAGGED_PARAM, target);
  const validMetaDatas = recursiveGetMetadata(IOC, PARAM_RULE_KEY, target);
  const validatedMetaDatas = recursiveGetMetadata(IOC, PARAM_CHECK_KEY, target);
  const argsMetaObj: ParamMetadataMap = {};
  for (const meta in metaDatas) {
    // 实例方法带规则形参必须小于等于原型形参(如果不存在验证规则，则小于)
    // if (instance[meta] && instance[meta].length <= metaDatas[meta].length) {
    Logger.Debug(`Register inject param key ${IOCContainer.getIdentifier(target)
      }: ${Helper.toString(meta)} => value: ${JSON.stringify(metaDatas[meta])}`);

    // cover to obj
    const data: ParamMetadata[] = (metaDatas[meta] ?? []).sort((a: ParamMetadata,
      b: ParamMetadata) => a.index - b.index);
    const validData = validMetaDatas[meta] ?? [];
    data.forEach((v: ParamMetadata) => {
      const validEntry = validData.find((it: any) => v.index === it.index && it.name === v.name);
      if (validEntry) {
        v.validRule = validEntry.rule;
        v.validOpt = validEntry.options;
      }
      v.type = v.isDto ? v.type : (v.type).toLowerCase();
      v.dtoCheck = !!(validatedMetaDatas[meta]?.dtoCheck);
      if (v.isDto) {
        v.clazz = IOCContainer.getClass(v.type, "COMPONENT");
        if (!v.clazz) {
          throw Error(`Failed to obtain the class ${v.type},
            because the class is not registered in the container.`);
        }
        if (v.dtoCheck) {
          v.dtoRule = getOriginMetadata(PARAM_TYPE_KEY, v.clazz);
          Reflect.defineProperty(v.clazz.prototype, "_typeDef", {
            enumerable: true,
            configurable: false,
            writable: false,
            value: v.dtoRule,
          });
        }
      }
      v.options = options
    });
    argsMetaObj[meta] = data;
    // }
  }
  return argsMetaObj;
}


/**
 * inject ParameterDecorator
 *
 * @param {Function} fn
 * @param {string} name
 * @returns {*}  {ParameterDecorator}
 */
export const injectParam = (fn: Function, name: string): ParameterDecorator => {
  return (target: object, propertyKey: string, descriptor: number) => {
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
    let type = paramTypes[descriptor]?.name || 'object';
    let isDto = false;
    //DTO class
    if (!(Helper.toString(type) in paramterTypes)) {
      type = IOCContainer.getIdentifier(paramTypes[descriptor]);
      // reg to IOC container
      // IOCContainer.reg(type, paramTypes[descriptor]);
      isDto = true;
    }

    IOCContainer.attachPropertyData(TAGGED_PARAM, {
      name: propertyKey,
      fn,
      index: descriptor,
      type,
      isDto
    }, target, propertyKey);
    return descriptor;
  };
};


/**
 * Parameter binding assignment.
 *
 * @param {Koatty} app
 * @param {KoattyContext} ctx
 * @param {any[]} params
 * @returns
 */
async function getParameter(app: Koatty, ctx: KoattyContext, params?: ParamMetadata[]) {
  const props = await Promise.all((params || []).map(async (v: ParamMetadata, k: number) => {
    let value: any = null;
    if (v.fn && Helper.isFunction(v.fn)) {
      value = await v.fn(ctx, v.options);
    }
    return checkParams(app, value, {
      index: k,
      isDto: v.isDto,
      type: v.type,
      validRule: v.validRule,
      validOpt: v.validOpt,
      dtoCheck: v.dtoCheck,
      dtoRule: v.dtoRule,
      clazz: v.clazz,
    });
  }));
  return props;
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
  validRule: Function | ValidRules | ValidRules[];
  validOpt: ValidOtpions;
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
  try {
    //@Validated
    if (opt.isDto) {
      // DTO class
      if (!opt.clazz) {
        opt.clazz = IOCContainer.getClass(opt.type, "COMPONENT");
      }
      value = opt.dtoCheck ? await ClassValidator.valid(opt.clazz, value, true) : plainToClass(opt.clazz, value, true);
    } else {
      // querystring default type is string, must be convert type
      value = convertParamsType(value, opt.type);
      //@Valid()
      if (opt.validRule) {
        validatorFuncs(`${opt.index}`, value, opt.type, opt.validRule, opt.validOpt);
      }
    }
    return value;
  } catch (err) {
    throw new Exception(err.message || `ValidatorError: invalid arguments.`, 1, 400);
  }
}


/**
 * Validated by funcs.
 *
 * @export
 * @param {string} name
 * @param {*} value
 * @param {string} type
 * @param {(ValidRules | ValidRules[] | Function)} rule
 * @param {ValidOtpions} [options]
 * @param {boolean} [checkType=true]
 * @returns
 */
function validatorFuncs(name: string, value: any, type: string,
  rule: ValidRules | ValidRules[] | Function, options?: ValidOtpions) {
  if (Helper.isFunction(rule)) {
    rule(value);
  } else {
    const funcs: any[] = Array.isArray(rule) ? rule : [rule].filter(Boolean);
    for (const func of funcs) {
      if (func in FunctionValidator) {
        FunctionValidator[<ValidRules>func](value, options);
      }
    }
  }
}

/**
 * @description: Function to detect and return a server based on the specified protocol.
 * @param {KoattyServer} servers A single server instance or an array of server instances.
 * @param {string} protocol The protocol to match against the server(s).
 * @return {*}
 */
export function detectServer(servers: KoattyServer | KoattyServer[], protocol: string) {
  if (!Helper.isArray(servers)) {
    return servers;
  }
  return servers.find((server) => server.options.protocol === protocol) || null;
}

/**
 * 获取class中所有public方法
 * @param classFilePath 
 * @param className 
 * @returns 
 */
export function getPublicMethods(classFilePath: string, className: string): string[] {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(classFilePath);

  // 查找类
  const classDeclaration = sourceFile.getClass(className);
  const publicMethods: string[] = [];

  if (classDeclaration) {
    // 遍历所有方法
    for (const method of classDeclaration.getMethods()) {
      const modifiers = method.getModifiers().map(mod => mod.getText());
      if (!modifiers.includes("private") && !modifiers.includes("protected")) {
        publicMethods.push(method.getName());
      }
    }
  }

  return publicMethods;
}

/**
 * get koatty controller paths
 * @param className 
 * @returns 
 */
function getControllerPath(className: string): string {
  return process.env.APP_PATH + "/controller/" + className + ".ts";
}