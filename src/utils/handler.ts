import { Koatty, KoattyContext } from "koatty_core";
import { Helper } from "koatty_lib";
import { Exception } from "koatty_exception";
import { ParamMetadata } from "./inject";
import { IOCContainer } from "koatty_container";
import {
  ClassValidator,
  convertParamsType,
  FunctionValidator,
  ValidOtpions,
  ValidRules,
  plainToClass
} from "koatty_validation";

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
 * Execute controller method with circuit breaker and parameter injection.
 * 
 * @param {Koatty} app - The Koatty application instance
 * @param {KoattyContext} ctx - The Koatty context object
 * @param {any} ctl - The controller instance
 * @param {string} method - The method name to execute
 * @param {ParamMetadata[]} [ctlParams] - Parameter metadata for injection
 * @param {any} [ctlParamsValue] - Parameter values for injection
 * @returns {Promise<any>} The execution result
 * @throws {Error} When controller not found or execution fails
 */
export async function Handler(app: Koatty, ctx: KoattyContext, ctl: any,
  method: string, ctlParams?: ParamMetadata[], ctlParamsValue?: any) {
    
  if (!ctx || !ctl) {
    return ctx.throw(404, `Controller not found.`);
  }
  ctl.ctx ??= ctx;
  // 注入参数
  const args = ctlParams ? await getParameter(app, ctx, ctlParams, ctlParamsValue) : [];
  // 执行方法
  const res = await ctl[method](...args);
  if (Helper.isError(res)) {
    throw res;
  }
  ctx.body = ctx.body || res;
  return ctx.body;
}

/**
 * Get and validate parameters for controller method.
 * 
 * @param {Koatty} app - The Koatty application instance
 * @param {KoattyContext} ctx - The Koatty context object
 * @param {ParamMetadata[]} [params] - Array of parameter metadata
 * @param {any} [ctlParamsValue] - Pre-defined parameter values
 * @returns {Promise<any[]>} Array of validated parameters
 * 
 * @description
 * Processes each parameter based on its metadata, applies validation rules,
 * and handles DTO transformations if specified. Parameters can be obtained
 * from custom functions or pre-defined values.
 */
async function getParameter(app: Koatty, ctx: KoattyContext, params?: ParamMetadata[], ctlParamsValue?: any) {
  const paramPromises = (params || []).map(async (v: ParamMetadata, k: number) => {
    const rawValue = ctlParamsValue?.[k] ??
      (v.fn && Helper.isFunction(v.fn) ? await v.fn(ctx, v.options) : null);

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
 * Validates and transforms parameters based on provided options
 * 
 * @param app - The Koatty application instance
 * @param ctx - The Koatty context object
 * @param value - The parameter value to validate
 * @param opt - Parameter validation options
 * @returns Promise resolving to the validated/transformed parameter value
 */
async function validateParam(app: Koatty, ctx: KoattyContext, value: any, opt: ParamOptions) {
  if (opt.isDto && !opt.clazz) {
    opt.clazz = IOCContainer.getClass(opt.type, "COMPONENT");
  }
  return checkParams(app, ctx, value, opt);
}

/**
 * Check and validate parameters based on provided options
 * 
 * @param app - Koatty application instance
 * @param ctx - Koatty context object
 * @param value - Parameter value to be validated
 * @param opt - Parameter validation options
 * @returns Validated and transformed parameter value
 * @throws {Exception} When validation fails with status code 400
 */
async function checkParams(app: Koatty, ctx: KoattyContext, value: any, opt: ParamOptions) {
  try {
    if (opt.isDto) {
      let validatedValue;
      if (opt.dtoCheck) {
        validatedValue = await ClassValidator.valid(opt.clazz, value, true);
      } else {
        validatedValue = plainToClass(opt.clazz, value, true);
      }
      return validatedValue;
    } else {
      value = convertParamsType(value, opt.type);
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
 * Validates a value against specified validation rules
 * 
 * @param name - Parameter name for error message
 * @param value - Value to validate
 * @param type - Type of the value
 * @param rule - Single rule, array of rules, or custom validation function
 * @param options - Optional validation options
 * @throws {Exception} When validation fails with status 400
 */
function validatorFuncs(name: string, value: any, type: string,
  rule: ValidRules | ValidRules[] | Function, options?: ValidOtpions) {
  if (Helper.isFunction(rule)) {
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
