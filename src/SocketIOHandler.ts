/* jslint node: true */
"use strict";

import { Messenger } from "@dojot/dojot-module";
import { logger } from "@dojot/dojot-module-logger";

import http = require("http");
import sio from "socket.io";
import uuid = require("uuid/v4");
import lodash from "lodash";

import { FilterManager } from "./FilterManager";
import { RedisManager } from "./redisManager";
import { TopicManagerBuilder } from "./TopicBuilder";

const TAG = { filename: "SocketIOHandler" };

function getKey(token: string): string {
  return "si:" + token;
}

interface IRegisteredSubjects {
  readonly [subject: string]: {
    readonly event: string;
    readonly callbackId: string;
    readonly sessions: number;
  };
}

interface ITokenSubjects {
  readonly [token: string]: ReadonlyArray<string>;
}

/**
 * Class used to handle SocketIO operations
 */
class SocketIOHandler {
  private ioServer: SocketIO.Server;
  private messenger: Messenger;
  private fManager: FilterManager;
  // Maintains a map of registered subjects with the data needed to unregister callbacks
  private registeredSubjects: IRegisteredSubjects;
  // Stores the subjects that connection needs
  private tokenSubjects: ITokenSubjects;

  /**
   * Constructor.
   * @param httpServer HTTP server as a basis to offer SocketIO connection
   */
  constructor(httpServer: http.Server, messenger: Messenger) {
    this.messenger = messenger;
    this.fManager = new FilterManager();
    this.registeredSubjects = {};
    this.tokenSubjects = {};

    logger.debug("Creating new SocketIO handler...", TAG);

    logger.debug("Creating sio server...", TAG);
    this.ioServer = sio(httpServer);
    logger.debug("... sio server was created.", TAG);

    logger.debug("Configuring sio server...", TAG);
    this.ioServer.use(this.checkSocket);
    logger.debug("... sio server was configured.", TAG);

    logger.debug("Registering SocketIO server callbacks...", TAG);
    this.ioServer.on("connection", (socket: sio.Socket) => {
      logger.debug("Got new SocketIO connection", TAG);

      logger.debug("Registering Messenger callbacks", TAG);
      const token = socket.handshake.query.token;
      this.registerCallback("device-data", "message", this.handleMessage.bind(this), token);
      this.registerCallback("dojot.device-manager.device", "message", this.handleMessageActuator.bind(this), token);

      logger.debug("Registering 'disconnect' callback", TAG);
      socket.on("disconnect", () => {
        logger.debug("Socket disconnected. Will unregister callbacks", TAG);
        this.removeCallbacks(token);
      });

      const redis = RedisManager.getClient();
      redis.runScript(
        __dirname + "/lua/setDel.lua",
        [getKey(socket.handshake.query.token)],
        [],
        (error: any, tenant: string) => {
          if (error || !tenant) {
            logger.error(
              `Failed to find suitable context for socket: ${socket.id}.`, TAG);
            logger.error("Disconnecting socket.", TAG);
            socket.disconnect();
          } else {
            logger.debug("Creating new socket...", TAG);
            this.processNewSocketIo(socket, tenant);
            logger.debug("... new socket created.", TAG);
          }
        },
      );
    });
    logger.debug("... SocketIO server callbacks were registered.", TAG);
    logger.debug("... SocketIO handler was created.", TAG);
  }

  public processNewSocketIo(socket: sio.Socket, tenant: string) {
    const givenSubject = socket.handshake.query.subject;
    const givenToken = socket.handshake.query.token;
    logger.debug(`Received subject is ${givenSubject}.`, TAG);
    logger.debug(`Received token is ${givenToken}.`, TAG);

    logger.debug(`Will assign client [${givenToken}] to namespace: (${tenant}): ${socket.id}`, TAG);
    if (givenSubject !== "dojot.notifications") {
      socket.join(tenant);
    } else {
      this.registerSocketIoNotification(socket, tenant);
    }
  }

  public registerSocketIoNotification(socket: sio.Socket, tenant: string) {
    logger.debug("Received connection for dojot.notifications", TAG);
    this.registerCallback("dojot.notifications", "message", (ten: string, msg: any) => {
      logger.debug("Received dojot notification.", TAG);
      if (ten === tenant) {
        if (this.fManager.checkFilter(msg, socket.id)) {
          socket.emit("notification", msg);
        }
      }
    }, socket.handshake.query.token);

    logger.debug("Will register new filter callback", TAG);
    socket.on("filter", (filter) => {
      logger.debug("Received new filter", TAG);
      this.fManager.update(JSON.parse(filter), socket.id);
    });
  }

  /**
   * Generate a new token to be used in SocketIO connection.
   * @param tenant The tenant related to this new token
   */
  public getToken(tenant: string): string {
    logger.debug(`Generating new token for tenant ${tenant}...`, TAG);

    logger.debug("Creating new topic/retrieving current for tenant", TAG);
    const topicManager = TopicManagerBuilder.get(tenant);
    topicManager.getCreateTopic(
      "device-data",
      (error?: any, topic?: string) => {
        if (error || !topic) {
          logger.error(
            `Failed to find appropriate topic for tenant: ${
            error ? error : "Unknown topic"
            }`, TAG);
          return;
        }
      });
    logger.debug("... Kafka topic creation/retrieval was requested.", TAG);

    logger.debug("Associating tenant and SocketIO token...", TAG);
    const token = uuid();
    const redis = RedisManager.getClient();
    redis.client.setex(getKey(token), 60, tenant);
    logger.debug("... token and tenant were associated.", TAG);

    logger.debug(`... token for tenant ${tenant} was created: ${token}.`, TAG);
    return token;
  }

  /**
   * Register a callback in Kafka Messenger events.
   * @param subject Kafka subject
   * @param event
   * @param callback callback to be registered for Kafka Messenger
   * @param token the token returned by the Socket
   */
  private registerCallback(subject: string, event: string, cb: (ten: string, data: any) => void, token: string): void {
    this.registerSubjectForToken(subject, token);

    if (this.registeredSubjects[subject] === undefined) {
      const callbackId = this.messenger.on(subject, event, cb);
      this.registeredSubjects = Object.assign({}, this.registeredSubjects, { [subject]: { event, callbackId, sessions: 1 }})
    } else {
      this.registeredSubjects = Object.assign(
        {},
        this.registeredSubjects,
        {
          [subject]: {
            event: this.registeredSubjects[subject].event,
            callbackId: this.registeredSubjects[subject].callbackId,
            sessions: this.registeredSubjects[subject].sessions + 1
          }
        }
      )
    }
  }

  /**
   * Register a subject in a token
   * @param subject subject to be registered
   * @param token token (connection) that requested the subjects' register
   */
  private registerSubjectForToken(subject: string, token: string): void {
    if (this.tokenSubjects[token] === undefined) {
      this.tokenSubjects = Object.assign({}, this.tokenSubjects, { [token]: new Array<string>(subject) });
    } else {
      this.tokenSubjects = Object.assign({}, this.tokenSubjects, { [token]: this.tokenSubjects[token].concat(subject) });
    }
  }

  /**
   * Stops Kafka messages consumption by removing the callbacks associated with it.
   */
  private removeCallbacks(token: string): void {
    // Decrementing the sessions for each subject this connection (token) has
    this.tokenSubjects[token].forEach((subject) => {
      this.registeredSubjects = Object.assign(
        {},
        this.registeredSubjects,
        {
          [subject]: {
            event: this.registeredSubjects[subject].event,
            callbackId: this.registeredSubjects[subject].callbackId,
            sessions: this.registeredSubjects[subject].sessions - 1
          }
        }
      )
    });
    // Removing `token` property from tokenSubjects and allocating the rest of the object to newTokenSubjects
    const { [token]: _, ...newTokenSubjects } = this.tokenSubjects;
    this.tokenSubjects = newTokenSubjects;

    // Unregistering the callbacks
    const toRemove = lodash.pickBy(this.registeredSubjects, (registeredSubject) => registeredSubject.sessions <= 0);
    lodash.forEach(toRemove, (registeredSubject, subject) => {
      this.messenger.unregisterCallback(subject, registeredSubject.event, registeredSubject.callbackId);
    });
    // Removing the subjects that had unregistered callbacks
    this.registeredSubjects = lodash.omit(this.registeredSubjects, Object.keys(toRemove));
  }

  /**
   * Callback function used to process messages received from Kafka library.
   * @param nsp SocketIO namespace to send out messages to all subscribers. These are tenants.
   * @param error Error received from Kafka library.
   * @param message The message received from Kafka Library
   */
  private handleMessage(nsp: string, message: string) {
    logger.debug("Processing message just received...", TAG);

    let data: any;
    logger.debug("Trying to parse received message payload...", TAG);
    try {
      data = JSON.parse(message);
    } catch (err) {
      if (err instanceof TypeError) {
        logger.debug("... message payload was not successfully parsed.", TAG);
        logger.error(`Received data is not a valid event: ${message}`, TAG);
      } else if (err instanceof SyntaxError) {
        logger.debug("... message payload was not successfully parsed.", TAG);
        logger.error(`Failed to parse event as JSON: ${message}`, TAG);
      }
      return;
    }
    logger.debug("... message payload was successfully parsed.", TAG);

    if (data.hasOwnProperty("metadata")) {
      if (!data.metadata.hasOwnProperty("deviceid")) {
        logger.debug("... received message was not successfully processed.", TAG);
        logger.error("Received data is not a valid dojot event - has no deviceid", TAG);
        return;
      }
    } else {
      logger.debug("... received message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no metadata", TAG);
      return;
    }

    logger.debug(`Will publish event to namespace ${nsp} from device ${data.metadata.deviceid}`,
      TAG);
    this.ioServer.to(nsp).emit(data.metadata.deviceid, data);
    this.ioServer.to(nsp).emit("all", data);
    logger.debug("... received message was successfully processed.", TAG);
  }

  /**
   * Callback function used to process actuator message received from Kafka library.
   * @param nsp SocketIO namespace to send out messages to all subscribers. These are tenants.
   * @param error Error received from Kafka library.
   * @param message The actuator message received from Kafka Library
   */
  private handleMessageActuator(nsp: string, message: string) {
    logger.debug("Processing actuator message just received...", TAG);
    let data: any;
    logger.debug("Trying to parse received actuator message payload...", TAG);
    try {
      data = JSON.parse(message);
    } catch (err) {
      if (err instanceof TypeError) {
        logger.debug("... actuator message payload was not successfully parsed.", TAG);
        logger.error(`Received data is not a valid event: ${message}`, TAG);
      } else if (err instanceof SyntaxError) {
        logger.debug("... actuator message payload was not successfully parsed.", TAG);
        logger.error(`Failed to parse event as JSON: ${message}`, TAG);
      }
      return;
    }
    logger.debug("... actuator message payload was successfully parsed.", TAG);

    if (!data.hasOwnProperty("event")) {
      logger.debug("... received actuator message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no event", TAG);
      return;
    } else if (data.event !== "configure") {
      logger.debug("... received actuator message was not successfully processed.", TAG);
      logger.debug("Received data is not a valid dojot event - event is not configure", TAG);
      return;
    }

    if (!data.hasOwnProperty("meta")) {
      logger.debug("... received actuator message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no meta", TAG);
      return;
    } else if (!data.meta.hasOwnProperty("service")) {
      logger.debug("... received actuator message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no meta.service", TAG);
      return;
    } else if (!data.meta.hasOwnProperty("timestamp")) {
      logger.debug("... received actuator message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no meta.timestamp", TAG);
      return;
    }

    if (!data.hasOwnProperty("data")) {
      logger.debug("... received actuator message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no data", TAG);
      return;
    } else if (!data.data.hasOwnProperty("id")) {
      logger.debug("... received actuator message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no data.id", TAG);
      return;
    } else if (!data.data.hasOwnProperty("attrs")) {
      logger.debug("... received actuator message was not successfully processed.", TAG);
      logger.error("Received data is not a valid dojot event - has no data.attrs", TAG);
      return;
    }
    const { data: { id: deviceid }, meta: { service: tenant, timestamp } } = data;
    const normalizeData = {
      attrs: data.data.attrs,
      metadata: {
        deviceid,
        tenant,
        timestamp,
      },
    };

    logger.debug(`Will publish event to namespace ${nsp} from device ${deviceid}`,
      TAG);
    this.ioServer.to(nsp).emit(deviceid, normalizeData);
    this.ioServer.to(nsp).emit("all", normalizeData);
    logger.debug("... received actuator message was successfully processed.", TAG);
  }

  /**
   *
   * @param socket The socket to be checked
   * @param next Next verification callback. Used by SocketIO library.
   */
  private checkSocket(socket: SocketIO.Socket, next: (error?: Error) => void) {
    const givenToken = socket.handshake.query.token;
    if (givenToken) {
      const redis = RedisManager.getClient();
      redis.client.select(0);
      redis.client.get(getKey(givenToken), (error, value) => {
        if (error) {
          return next(new Error("Failed to verify token"));
        }
        if (value) {
          return next();
        } else {
          return next(new Error("Authentication error: unknown token"));
        }
      });
    } else {
      return next(new Error("Authentication error: missing token"));
    }
  }
}

export { SocketIOHandler };
