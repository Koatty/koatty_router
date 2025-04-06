/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-12-09 12:02:29
 * @LastEditTime: 2025-03-15 22:21:29
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import "reflect-metadata";
import {
  getOriginMetadata, IOC, IOCContainer, recursiveGetMetadata,
  TAGGED_PARAM
} from "koatty_container";
import { CONTROLLER_ROUTER, Koatty, KoattyContext } from "koatty_core";
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
 * Execute controller method with dependency injection and parameter handling.
 * 
 * @param app - Koatty application instance
 * @param ctx - Koatty context object
 * @param ctl - Controller instance
 * @param method - Method name to be executed
 * @param ctlParams - Parameter metadata for dependency injection
 * @param ctlParamsValue - Parameter values for injection
 * @returns The response body
 * @throws {Error} 404 if controller not found
 */
export async function Handler(app: Koatty, ctx: KoattyContext, ctl: any,
  method: string, ctlParams?: ParamMetadata[], ctlParamsValue?: any) {
  if (!ctx || !ctl) {
    return ctx.throw(404, `Controller not found.`);
  }
  ctl.ctx ??= ctx;
  // inject param
  const args = ctlParams ? await getParameter(app, ctx, ctlParams, ctlParamsValue) : [];
  // method
  const res = await ctl[method](...args);
  if (Helper.isError(res)) {
    throw res;
  }
  ctx.body = ctx.body || res;
  return ctx.body;
}

/**
 *
 *
 * @interface RouterMetadata
 */
interface RouterMetadata {
  method: string;
  path: string;
  ctlPath: string;
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
 * Inject router metadata for a controller class.
 * 
 * @param app - The Koatty application instance
 * @param target - The controller class target
 * @param protocol - The protocol type, defaults to 'http'
 * @returns RouterMetadataObject containing route mappings, or null if protocol doesn't match
 * 
 * @description
 * This function processes controller class metadata to generate router mappings.
 * It extracts the controller path, validates method scopes in debug mode,
 * and combines controller and method level route configurations.
 */
export function injectRouter(app: Koatty, target: any, protocol = 'http'): RouterMetadataObject | null {
// Controller router path
  const ctlName = IOCContainer.getIdentifier(target);
  const options = IOCContainer.getPropertyData(CONTROLLER_ROUTER, target, ctlName) ||
    { path: "", protocol: 'http' };
  options.path = options.path.startsWith("/") || options.path === "" ? options.path : `/${options.path}`;
  if (options.protocol !== protocol) return null;

  const rmetaData = recursiveGetMetadata(IOC, MAPPING_KEY, target);
  const router: RouterMetadataObject = {};
  const methods: string[] = [];
  if (app.appDebug) {
    const ctlPath = getControllerPath(ctlName);
    methods.push(...getPublicMethods(ctlPath, ctlName));
  }

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
        path: `${options.path}${val.path}`.replace("//", "/"),
        ctlPath: options.path,
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
 * Inject parameter metadata for dependency injection.
 * 
 * @param app - The Koatty application instance
 * @param target - The target class to inject parameters
 * @param options - Optional payload options for parameter injection
 * @returns A map of parameter metadata for each method
 * 
 * @description
 * This function processes and combines various metadata including injection data,
 * validation rules, and DTO checks. It sorts parameters by index, applies validation
 * rules, and handles DTO class registration. For DTO parameters, it ensures the class
 * is registered in the IOC container and sets up type definitions if DTO validation
 * is enabled.
 * 
 * @throws Error when a DTO class is not registered in the container
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
      if (options) {
        v.options = options;
      }
    });
    argsMetaObj[meta] = data;
    // }
  }
  return argsMetaObj;
}

/**
 * Creates a parameter decorator for dependency injection.
 * 
 * @param fn The function to be injected
 * @param name The name of the decorator
 * @returns A ParameterDecorator that handles the injection
 * @throws Error if decorator is used outside of a controller class
 * 
 * @example
 * ```typescript
 * @Controller()
 * class UserController {
 *   @Get("/user")
 *   getUser(@Get() query: QueryDTO) {}
 * }
 * ```
 */
export const injectParam = (fn: Function, name: string): ParameterDecorator => {
  return (target: object, propertyKey: string | symbol | undefined, descriptor: number) => {
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
 * Get and validate parameters for controller method.
 * 
 * @param {Koatty} app - The Koatty application instance
 * @param {KoattyContext} ctx - The Koatty context object
 * @param {ParamMetadata[]} [params] - Array of parameter metadata
 * @param {any} [ctlParamsValue] - Pre-defined parameter values
 * @returns {Promise<any[]>} Array of validated parameter values
 * 
 * @description
 * Processes parameters in parallel, including:
 * - Parameter value extraction from context or custom function
 * - Parameter validation based on rules and DTOs
 * - Type checking and transformation
 */
async function getParameter(app: Koatty, ctx: KoattyContext, params?: ParamMetadata[], ctlParamsValue?: any) {
// 并行处理参数获取和验证
  const paramPromises = (params || []).map(async (v: ParamMetadata, k: number) => {
    const rawValue = ctlParamsValue?.[k] ??
      (v.fn && Helper.isFunction(v.fn) ? await v.fn(ctx, v.options) : null);

    // 并行执行参数验证
    return validateParam(app, ctx, rawValue, {
      index: k,
      isDto: v.isDto,
      type: v.type,
      validRule: v.validRule,
      validOpt: v.validOpt,
      dtoCheck: v.dtoCheck,
      dtoRule: v.dtoRule,
      clazz: v.clazz,
    });
  });

  return Promise.all(paramPromises);
}

/**
 * Validates and transforms parameter values based on provided options
 * 
 * @param app - The Koatty application instance
 * @param ctx - The Koatty context object
 * @param value - The parameter value to validate
 * @param opt - Parameter validation options
 * @returns Promise resolving to the validated/transformed value
 */
async function validateParam(app: Koatty, ctx: KoattyContext, value: any, opt: ParamOptions) {
  if (opt.isDto && !opt.clazz) {
    opt.clazz = IOCContainer.getClass(opt.type, "COMPONENT");
  }
  return checkParams(app, ctx, value, opt);
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
 * @param {KoattyContext} ctx
 * @param {*} value
 * @param {ParamOptions} opt
 * @returns {*}  
 */
async function checkParams(app: Koatty, ctx: KoattyContext, value: any, opt: ParamOptions) {
  try {
    //@Validated
    if (opt.isDto) {

      let validatedValue;
      if (opt.dtoCheck) {
        validatedValue = await ClassValidator.valid(opt.clazz, value, true);
      } else {
        validatedValue = plainToClass(opt.clazz, value, true);
      }

      return validatedValue;
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
 * Validate value with specified rules.
 * 
 * @param name The parameter name to validate
 * @param value The value to validate
 * @param type The type of value
 * @param rule Validation rule(s). Can be a function, a single rule string, or an array of rule strings
 * @param options Optional validation options
 * @throws {Error} Throws error if validation fails
 */
function validatorFuncs(name: string, value: any, type: string,
  rule: ValidRules | ValidRules[] | Function, options?: ValidOtpions) {
  if (Helper.isFunction(rule)) {
    // 自定义验证函数
    rule(value);
    return;
  }

  const funcs: ValidRules[] = Helper.isString(rule) ? [rule as ValidRules] : 
                            Helper.isArray(rule) ? rule as ValidRules[] : [];

  for (const func of funcs) {
    if (!Object.hasOwnProperty.call(FunctionValidator, func)) {
      continue;
    }
    
    try {
      // 任一验证失败立即抛出异常
      FunctionValidator[func](value, options);
    } catch (err) {
      throw new Exception(
        `Validation failed for param ${name}: ${err.message}`,
        1,
        400
      );
    }
  }
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
