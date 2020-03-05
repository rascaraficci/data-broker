/* jslint node: true */
"use strict";

import { logger } from "@dojot/dojot-module-logger";
import crypto = require("crypto");
import fs = require("fs");
import redis = require("redis");
import util = require("util");

const TAG = { filename: "RedisClient" };

export interface IAssignedScheme {
  replica_assigment: {
    [partition: string]: number[];
  };
}

export interface IAutoScheme {
  num_partitions: number;
  replication_factor: number;
}
export interface ITopicProfile {
  [name: string]: IAssignedScheme | IAutoScheme;
}

/**
 * Client for REDIS database
 */
class ClientWrapper {
  public client: redis.RedisClient;
  private cb: (error: any, data: any) => void;

  constructor(client: redis.RedisClient) {
    this.client = client;
    this.cb = () => { return; };
  }

  /**
   * Run a simple script to fetch or update data in REDIS.
   *
   * @param path Where the script is located
   * @param keys Keys to be fetched
   * @param vals If defined, the values to be updated in REDIS
   * @param callback Callback invoked when the request finishes.
   */
  public runScript(path: string, keys: string[], vals: string[], callback: (error: any, data: any) => void) {
    const script = fs.readFileSync(path, { encoding: "utf-8" });
    const sha1 = crypto.createHash("sha1").update(script).digest("hex");
    this.cb = callback;
    const evalshaCallbackBind = this.evalshaCallback.bind(this);

    const evalOrLoadCallback = (err: any, data: any) => {
      if (err) {
        logger.debug(`Error while trying to run the script: ${util.inspect(err)}`, TAG);
        if (err.code === "NOSCRIPT") {
          this.client.script("load", script, () => {
            if (vals && (vals.length > 0)) {
              this.client.select(0);
              this.client.evalsha(sha1, keys.length, keys[0], vals[0], evalshaCallbackBind);
            } else {
              this.client.evalsha(sha1, keys.length, keys[0], evalshaCallbackBind);
            }
          });
        }
      } else {
        this.cb(undefined, data);
      }
    };

    if (vals && (vals.length > 0)) {
      this.client.select(0);
      this.client.evalsha(sha1, keys.length, keys[0], vals[0], evalOrLoadCallback);
    } else {
      this.client.evalsha(sha1, keys.length, keys[0], evalOrLoadCallback);
    }
  }

  private evalshaCallback(err: any, data: any) {
    if (err) {
      logger.error(`Error while trying to execute the script: ${util.inspect(err)}`, TAG);
      this.cb(err, undefined);
    } else {
      this.cb(undefined, data);
    }
  }
}

export { ClientWrapper };
