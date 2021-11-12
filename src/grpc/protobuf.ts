/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-10 10:19:48
 * @LastEditTime: 2021-11-11 17:24:00
 */
import * as Helper from "koatty_lib";
import { GrpcObject, loadPackageDefinition } from "@grpc/grpc-js";
import { loadSync, Options } from "@grpc/proto-loader";

/**
 *
 *
 * @export
 * @interface ProtoDef
 */
export interface ProtoDef {
    name: string;
    path: string;
    service: GrpcObject;
}

/**
 * LoadProto
 *
 * @export
 * @param {string} protoFile
 * @returns {*}  
 */
export async function LoadProto(protoFile: string, options?: Options): Promise<ProtoDef[]> {
    if (!Helper.isFile(protoFile)) {
        throw new Error("no such file: " + protoFile);
    }
    // Loading file
    const parsedObj = await loadSync(protoFile, options);
    const def = loadPackageDefinition(parsedObj);
    return ListServices('', def);
}

/**
 * ListServices
 *
 * @export
 * @param {string} root
 * @param {*} def
 * @returns {*}  {*}
 */
export function ListServices(root: string, def: GrpcObject): ProtoDef[] {
    const results: ProtoDef[] = [];
    for (const [propName, value] of Object.entries(def)) {
        let objPath = propName;
        if (root) {
            objPath = root + '.' + propName;
        }
        if (value && value.hasOwnProperty('service')) {
            results.push({
                name: propName,
                path: objPath,
                service: <GrpcObject>value,
            });
        } else if (value && typeof value === "object") {
            results.push(...ListServices(objPath, <GrpcObject>value));
        }
    }
    return results;
}
