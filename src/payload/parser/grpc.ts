/*
 * @Description: Payload parsing utilities with performance optimizations
 * @Usage: Parse request body based on content-type with caching
 * @Author: richen
 * @Date: 2023-12-09 12:02:29
 * @LastEditTime: 2025-01-20 10:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { DefaultLogger as Logger } from "koatty_logger";
import { KoattyContext } from "koatty_core";
import { PayloadOptions } from "../interface";
import getRawBody from "raw-body";
import inflate from "inflation";

/**
 * Parse gRPC request payload from the context
 * 
 * @param {KoattyContext} ctx - Koatty context object
 * @param {PayloadOptions} opts - Payload parsing options
 * @returns {Promise<{body: string} | {}>} Parsed request body or empty object if parsing fails
 * @description Handles gRPC specific payload parsing using protobuf format
 */
export async function parseGrpc(ctx: KoattyContext, opts: PayloadOptions) {
  try {
    // gRPC使用protobuf格式，需要特殊处理
    const buffer = await getRawBody(inflate(ctx.req), opts);
    return { body: buffer.toString() };
  } catch (error) {
    Logger.Error('[GrpcParseError]', error);

    return {};
  }
}
