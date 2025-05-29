/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-12-09 12:02:29
 * @LastEditTime: 2025-01-20 10:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

import { Koatty, KoattyRouter } from "koatty_core";
import { Helper } from "koatty_lib";
import { RouterFactory } from "./factory";
import { PayloadOptions } from "../payload/interface";

/**
 * RouterOptions
 *
 * @export
 * @interface RouterOptions
 */
export interface RouterOptions {
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
  // server protocol
  protocol?: string;

  /**
   * payload options
   */
  payload?: PayloadOptions;
  /**
   * Other extended configuration
   */
  ext?: Record<string, any>;
  // {
  //  // gRPC protocol file
  //  protoFile ?: string;
  //  // graphql schema file
  //  schemaFile ?: string;
  //}
}

/**
 * get instance of Router using Factory Pattern
 *
 * @export
 * @param {Koatty} app
 * @param {RouterOptions} options
 * @returns {*}  {KoattyRouter}
 */
export function NewRouter(app: Koatty, opt?: RouterOptions): KoattyRouter {
  const options: RouterOptions = { protocol: "http", prefix: "", ...opt };
  
  // Use RouterFactory to create router instance
  const factory = RouterFactory.getInstance();
  const router = factory.create(options.protocol!, app, options);

  // payload middleware
  app.once("ready", () => {
    app.use(payload(this.options.payload));
  });

  Helper.define(router, "protocol", options.protocol);
  return router;
}