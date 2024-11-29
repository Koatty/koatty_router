/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-12-09 12:02:29
 * @LastEditTime: 2024-11-28 14:44:53
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Koatty, KoattyRouter } from "koatty_core";
import { Helper } from "koatty_lib";
import { PayloadOptions } from "../params/payload";
import { GrpcRouter } from "./grpc";
import { HttpRouter } from "./http";
import { WebsocketRouter } from "./ws";

/**
 * RouterOptions
 *
 * @export
 * @interface RouterOptions
 */
export interface RouterOptions {
  protocol: string;
  prefix: string;
  /**
   * Methods which should be supported by the router.
   */
  methods?: string[];
  routerPath?: string;
  /**
   * Whether or not routing should be case-sensitive.
   */
  sensitive?: boolean;
  /**
   * Whether or not routes should matched strictly.
   *
   * If strict matching is enabled, the trailing slash is taken into
   * account when matching routes.
   */
  strict?: boolean;
  /**
   * gRPC protocol file
   */
  protoFile?: string;

  /**
   * payload options
   */
  payload?: PayloadOptions;
  // 
  /**
   * Other extended configuration
   */
  ext?: any;
}

/**
 * get instance of Router
 *
 * @export
 * @param {Koatty} app
 * @param {RouterOptions} options
 * @param {string} [protocol]
 * @returns {*}  {KoattyRouter}
 */
export function NewRouter(app: Koatty, opt?: RouterOptions): KoattyRouter {
  // const protocol = app.config("protocol") || "http";
  // const opts: RouterOptions = app.config(undefined, 'router') ?? {};
  const options: RouterOptions = { protocol: "http", prefix: "", ...opt };
  let router;
  if (options.protocol === "grpc") {
    router = new GrpcRouter(app, options);
  } else if (options.protocol === "ws" || options.protocol === "wss") {
    router = new WebsocketRouter(app, options);
  } else {
    router = new HttpRouter(app, options);
  }

  Helper.define(router, "protocol", options.protocol);
  return router;
}