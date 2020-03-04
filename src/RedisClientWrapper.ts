/* jslint node: true */
"use strict";

import { logger } from "@dojot/dojot-module-logger";
import crypto = require("crypto");
import fs = require("fs");
import redis = require("redis");

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

  constructor(client: redis.RedisClient) {
    this.client = client;
  }

  /**
   * Sets data into redis[1]
   *
   * @param key key 'tenant:subject' to be fetched
   * @param val value of the key
   */

  public setConfig(key: string, val: any) {
    this.client.select(1);
    this.client.set(key, val);
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

    const evalshaCallback = (err: any, data: any) => {
      if (err) {
        logger.error(`Error while trying to execute the script: ${err}`, TAG);
        callback(err, undefined);
      } else {
        callback(undefined, data);
      }
    };

    const evalOrLoadCallback = (err: any, data: any) => {
      if (err) {
        logger.debug(`Error while trying to run the script: ${err}`, TAG);
        if (err.code === "NOSCRIPT") {
          this.client.script("load", script, () => {
            if (vals && (vals.length > 0)) {
              this.client.select(0);
              this.client.evalsha(sha1, keys.length, keys[0], vals[0], evalshaCallback);
            } else {
              this.client.evalsha(sha1, keys.length, keys[0], evalshaCallback);
            }
          });
        }
      } else {
        callback(undefined, data);
      }
    };

    if (vals && (vals.length > 0)) {
      this.client.select(0);
      this.client.evalsha(sha1, keys.length, keys[0], vals[0], evalOrLoadCallback);
    } else {
      this.client.evalsha(sha1, keys.length, keys[0], evalOrLoadCallback);
    }
  }
}

export { ClientWrapper };
