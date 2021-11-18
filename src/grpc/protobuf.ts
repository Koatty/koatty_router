/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-10 10:19:48
 * @LastEditTime: 2021-11-18 16:17:16
 */
import * as Helper from "koatty_lib";
import { GrpcObject, loadPackageDefinition, ServiceDefinition } from "@grpc/grpc-js";
import { loadSync, Options, ProtobufTypeDefinition } from "@grpc/proto-loader";

/**
 *
 *
 * @export
 * @interface ProtoDef
 */
export interface ProtoDef {
    name: string;
    service: ServiceDefinition;
    handlers: ProtoDefHandler[];
}

export interface ProtoDefHandler {
    name: string;
    path: string;
    fn?: Function;
}

/**
 * LoadProto
 *
 * @export
 * @param {string} protoFile
 * @returns {*}  
 */
export function LoadProto(protoFile: string, options: Options = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
}): ProtoDef[] {
    if (!Helper.isFile(protoFile)) {
        throw new Error("no such file: " + protoFile);
    }
    // Loading file
    const parsedObj = loadSync(protoFile, options);
    const def = loadPackageDefinition(parsedObj);
    return ListServices(def);
}

/**
 * ListServices
 *
 * @export
 * @param {*} def
 * @returns {*}  {*}
 */
export function ListServices(def: GrpcObject | ProtobufTypeDefinition): ProtoDef[] {
    const results: ProtoDef[] = [];
    for (const [propName, value] of Object.entries(def)) {
        if (value) {
            if (typeof value === "function" && value.hasOwnProperty('service')) {
                const service = value.service;
                const handlers = [];
                for (const key in service) {
                    if (Object.hasOwnProperty.call(service, key)) {
                        const element = service[key];
                        handlers.push({
                            name: key,
                            path: element.path,
                        })
                    }
                }
                results.push({
                    name: propName,
                    service: service,
                    handlers: handlers,
                });
            } else if (Helper.isObject(value)) {
                results.push(...ListServices(value));
            }
        }
    }
    return results;
}
