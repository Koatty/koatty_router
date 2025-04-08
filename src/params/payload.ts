/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-12-09 12:30:20
 * @LastEditTime: 2025-04-08 16:36:53
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { BufferEncoding, IncomingForm } from "formidable";
import inflate from "inflation";
import { KoattyContext, KoattyNext } from "koatty_core";
import { Helper } from "koatty_lib";
import { DefaultLogger as Logger } from "koatty_logger";
import onFinished from "on-finished";
import { parse } from "fast-querystring";
import getRawBody from "raw-body";
import { XMLParser } from "fast-xml-parser";
import { deleteFiles } from "../utils/path";

interface XMLParserOptions {
  ignoreAttributes: boolean;
  isArray: (name: string) => boolean;
}

export interface PayloadOptions {
  extTypes: {
    json: string[],
    form: string[],
    text: string[],
    multipart: string[],
    xml: string[],
  };
  limit: string;
  encoding: BufferEncoding;
  multiples: boolean;
  keepExtensions: boolean;
  length?: number;
}

const defaultOptions: PayloadOptions = {
  extTypes: {
    json: ['application/json'],
    form: ['application/x-www-form-urlencoded'],
    text: ['text/plain'],
    multipart: ['multipart/form-data'],
    xml: ['text/xml']
  },
  limit: '20mb',
  encoding: 'utf-8',
  multiples: true,
  keepExtensions: true,
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  isArray: () => false,
} as XMLParserOptions);

/**
 * Middleware for parsing request payload (query parameters and request body).
 * 
 * @param {PayloadOptions} [options] - Configuration options for payload parsing
 * @returns {Function} Koa middleware function that adds requestParam and requestBody to context
 * 
 * @example
 * ```ts
 * app.use(payload({
 *   // payload options
 * }));
 * ```
 */
export function payload(options?: PayloadOptions) {
  return (ctx: KoattyContext, next: KoattyNext) => {
    Helper.define(ctx, "requestParam", () => queryParser(ctx, options));
    Helper.define(ctx, "requestBody", () => bodyParser(ctx, options));
    return next();
  }
}

/**
 * Parse and merge query parameters and route parameters from context
 * @param {KoattyContext} ctx Koatty context object
 * @param {PayloadOptions} [_options] Optional payload configuration
 * @returns {any} Merged object containing query and route parameters
 */
export function queryParser(ctx: KoattyContext, _options?: PayloadOptions): any {
  return Object.assign({}, ctx.query, ctx.params || {});
}

/**
 * Parse request body and store it in context metadata.
 * 
 * @param {KoattyContext} ctx - Koatty context object
 * @param {PayloadOptions} [options] - Optional payload parsing options
 * @returns {Promise<any>} Parsed request body
 * @throws {Error} When body parsing fails
 */
export async function bodyParser(ctx: KoattyContext, options?: PayloadOptions): Promise<any> {
  try {
    let body = ctx.getMetaData("_body")[0];
    if (!Helper.isEmpty(body)) {
      return body;
    }
    const mergedOptions = Object.assign({}, defaultOptions, options);
    body = await parseBody(ctx, mergedOptions);
    ctx.setMetaData("_body", body);
    return body;
  } catch (err) {
    Logger.Error(err);

    return {};
  }
}

interface ParserMap {
  [key: string]: (ctx: KoattyContext, opts: PayloadOptions) => Promise<any>;
}

const supportedMethods = new Set(['POST', 'PUT', 'DELETE', 'PATCH', 'LINK', 'UNLINK']);
const contentTypeRegex = /^(application\/json|application\/x-www-form-urlencoded|text\/plain|multipart\/form-data|text\/xml|application\/grpc|application\/graphql\+json|application\/websocket)/i;

/**
 * Parse request body based on content-type.
 * 
 * @param {KoattyContext} ctx - Koatty context object
 * @param {PayloadOptions} options - Parser options including encoding, limit, etc.
 * @returns {Promise<unknown>} Parsed body data or empty object
 * 
 * @description
 * Handles different content types:
 * - application/json
 * - application/x-www-form-urlencoded
 * - text/plain
 * - multipart/form-data
 * - text/xml
 * - application/grpc
 * - application/graphql+json
 * - application/websocket
 */
function parseBody(ctx: KoattyContext, options: PayloadOptions): Promise<unknown> {
  if (!supportedMethods.has(ctx.method)) {
    return Promise.resolve({});
  }

  const len = ctx.req.headers['content-length'];
  const encoding = ctx.req.headers['content-encoding'] || 'identity';
  if (len && encoding === 'identity') {
    options.length = ~~len;
  }
  options.encoding = options.encoding || 'utf8';
  options.limit = options.limit || '1mb';

  const contentType = ctx.request.headers['content-type'] || '';
  const match = contentType.match(contentTypeRegex);
  if (!match) {
    return Promise.resolve({});
  }

  const typeMap: ParserMap = {
    'application/json': parseJson,
    'application/x-www-form-urlencoded': parseForm,
    'text/plain': parseText,
    'multipart/form-data': parseMultipart,
    'text/xml': parseXml,
    'application/grpc': parseGrpc,
    'application/graphql+json': parseGraphQL,
    'application/websocket': parseWebSocket
  };

  const parser = typeMap[match[1]];
  return parser ? parser(ctx, options) : Promise.resolve({});
}

/**
 * Parse form-urlencoded request body.
 * 
 * @param {KoattyContext} ctx - The Koatty context object
 * @param {PayloadOptions} opts - The payload parsing options
 * @returns {Promise<{body?: any}>} Parsed form data object with body property, or empty object if parsing fails
 * @private
 */
async function parseForm(ctx: KoattyContext, opts: PayloadOptions) {
// Early return for empty or invalid content
  if (!ctx.request.headers['content-length'] ||
    !ctx.request.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
    return {};
  }

  const str = await parseText(ctx, opts);
  if (!str || str.trim().length === 0) {
    return {};
  }

  try {
    const result = parse(str);
    return {
      body: result
    };
  } catch (error) {
    Logger.Error('[FormParseError]', error);

    return {};
  }
}

/**
 * Parse multipart/form-data request payload
 * 
 * @param ctx KoattyContext - The Koatty context object
 * @param opts PayloadOptions - Configuration options for parsing
 * @returns Promise<{body: any, file: any}> - Resolves with parsed fields and files
 * 
 * @description
 * Handles multipart form data parsing using IncomingForm.
 * Supports file uploads with automatic cleanup on response finish.
 * Returns empty objects if content-type is not multipart or if parsing fails.
 * 
 * @example
 * const { body, file } = await parseMultipart(ctx, {
 *   encoding: 'utf-8',
 *   multiples: true,
 *   keepExtensions: true,
 *   limit: 20 // Max file size in MB
 * });
 */
function parseMultipart(ctx: KoattyContext, opts: PayloadOptions) {
// Early validation
  if (!ctx.request.headers['content-type']?.includes('multipart/form-data')) {
    return Promise.resolve({ body: {}, file: {} });
  }

  const form = new IncomingForm({
    encoding: <BufferEncoding>opts.encoding,
    multiples: opts.multiples,
    keepExtensions: opts.keepExtensions,
    maxFileSize: opts.limit ? parseInt(opts.limit) * 1024 * 1024 : 20 * 1024 * 1024,
  });

  const cleanup = () => {
    if (uploadFiles) {
      try {
        deleteFiles(uploadFiles);
      } catch (e) {
        Logger.Error('[FileCleanupError]', e);

      }
    }
  };

  let uploadFiles: any = null;
  onFinished(ctx.res, cleanup);

  return new Promise((resolve) => {
    form.parse(ctx.req, (err, fields, files) => {
      if (err) {
        cleanup();
        Logger.Error('[MultipartParseError]', err);

        return resolve({ body: {}, file: {} });
      }

      uploadFiles = files;
      resolve({
        body: fields,
        file: files
      });
    });
  });
}

/**
 * Parse request body as JSON
 * @param {KoattyContext} ctx - Koatty context object
 * @param {PayloadOptions} opts - Payload parsing options
 * @returns {Promise<{body?: any}>} Parsed JSON object with body property, or empty object if parsing fails
 */
async function parseJson(ctx: KoattyContext, opts: PayloadOptions) {
  const str = await parseText(ctx, opts);
  if (!str) return {};

  try {
    return { body: JSON.parse(str) };
  } catch (error) {
    Logger.Error(error);

    return {};
  }
}

/**
 * Parse raw request body as text.
 * 
 * @param {KoattyContext} ctx - Koatty context object
 * @param {PayloadOptions} opts - Payload parsing options
 * @returns {Promise<string>} Parsed text content, empty string if parsing fails
 */
function parseText(ctx: KoattyContext, opts: PayloadOptions): Promise<string> {
  return getRawBody(inflate(ctx.req), opts)
    .catch(err => {
      Logger.Error(err);

      return "";
    });
}

/**
 * Parse gRPC request payload from the context
 * 
 * @param {KoattyContext} ctx - Koatty context object
 * @param {PayloadOptions} opts - Payload parsing options
 * @returns {Promise<{body: string} | {}>} Parsed request body or empty object if parsing fails
 * @description Handles gRPC specific payload parsing using protobuf format
 */
async function parseGrpc(ctx: KoattyContext, opts: PayloadOptions) {
  try {
    // gRPC使用protobuf格式，需要特殊处理
    const buffer = await getRawBody(inflate(ctx.req), opts);
    return { body: buffer.toString() };
  } catch (error) {
    Logger.Error('[GrpcParseError]', error);

    return {};
  }
}

/**
 * Parse GraphQL request payload from context
 * @param ctx KoattyContext instance
 * @param opts PayloadOptions for parsing
 * @returns {Promise<{query?: string, variables?: object, operationName?: string|null}>} Parsed GraphQL payload object
 * @description Parses the GraphQL request body and returns an object containing query, variables, and operationName.
 * If parsing fails, returns an empty object and logs the error.
 */
async function parseGraphQL(ctx: KoattyContext, opts: PayloadOptions) {
  try {
    const str = await parseText(ctx, opts);
    if (!str) return {};

    const payload = JSON.parse(str);
    return {
      query: payload.query,
      variables: payload.variables || {},
      operationName: payload.operationName || null
    };
  } catch (error) {
    Logger.Error('[GraphQLParseError]', error);

    return {};
  }
}

/**
 * Parse WebSocket message data from context
 * @param ctx KoattyContext instance
 * @param opts PayloadOptions for parsing configuration
 * @returns {Promise<object|string>} Parsed message data as object for JSON or string for plain text
 * @description Attempts to parse WebSocket message as JSON first, falls back to raw text if JSON parsing fails
 * @throws {Error} Logs error if parsing fails and returns empty object
 */
async function parseWebSocket(ctx: KoattyContext, opts: PayloadOptions) {
  try {
    const str = await parseText(ctx, opts);
    if (!str) return {};

    // WebSocket消息可能是JSON或纯文本
    try {
      return { body: JSON.parse(str) };
    } catch {
      return str;
    }
  } catch (error) {
    Logger.Error('[WebSocketParseError]', error);

    return {};
  }
}

/**
 * Parse XML payload from request body
 * @param ctx KoattyContext instance
 * @param opts Payload parsing options
 * @returns {Promise<{body?: any}>} Parsed XML object in body property or empty object if parsing fails
 */
async function parseXml(ctx: KoattyContext, opts: PayloadOptions) {
  const str = await parseText(ctx, opts);
  if (!str) return {};

  try {
    return { body: xmlParser.parse(str) };
  } catch (error) {
    Logger.Error(error);

    return {};
  }
}
