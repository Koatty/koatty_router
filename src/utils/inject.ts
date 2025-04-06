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
import { CONTROLLER_ROUTER, Koatty } from "koatty_core";
import { Helper } from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import { Project } from "ts-morph";
import { MAPPING_KEY } from "../params/mapping";
import { PayloadOptions } from "../params/payload";
import {
  PARAM_CHECK_KEY, PARAM_RULE_KEY, PARAM_TYPE_KEY,
  paramterTypes, ValidOtpions, ValidRules
} from "koatty_validation";

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
  const metaDatas = recursiveGetMetadata(IOC, TAGGED_PARAM, target);
  const validMetaDatas = recursiveGetMetadata(IOC, PARAM_RULE_KEY, target);
  const validatedMetaDatas = recursiveGetMetadata(IOC, PARAM_CHECK_KEY, target);
  const argsMetaObj: ParamMetadataMap = {};

  for (const meta in metaDatas) {
    Logger.Debug(`Register inject param key ${IOCContainer.getIdentifier(target)
      }: ${Helper.toString(meta)} => value: ${JSON.stringify(metaDatas[meta])}`);

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
    // const keys = Reflect.getMetadataKeys(target, propertyKey);    let type = paramTypes[descriptor]?.name || 'object';
    let type = paramTypes[descriptor]?.name || 'object';
    let isDto = false;

    if (!(Helper.toString(type) in paramterTypes)) {
      type = IOCContainer.getIdentifier(paramTypes[descriptor]);
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
 * Gets all public method names from a TypeScript class.
 * 
 * @param classFilePath - The absolute file path to the TypeScript class file
 * @param className - The name of the class to analyze
 * @returns An array of strings containing the names of all public methods
 * 
 * @example
 * ```ts
 * const methods = getPublicMethods('/path/to/class.ts', 'MyClass');
 * // returns ['method1', 'method2', ...]
 * ```
 */
export function getPublicMethods(classFilePath: string, className: string): string[] {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(classFilePath);

  const classDeclaration = sourceFile.getClass(className);
  const publicMethods: string[] = [];

  if (classDeclaration) {
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
