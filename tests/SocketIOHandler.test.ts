/* jslint node: true */

import { Messenger } from "@dojot/dojot-module";
import "jest";
import http = require("http");
import { Callback } from "redis";
import { SocketIOHandler } from "../src/SocketIOHandler";
import { logger } from "@dojot/dojot-module-logger";

/**
 * Variables
 */
// Callback control
// For function redis.client.get()
let cbError: Error | null;
let cbReply: string;
// Mock functions
const mockConfig = {
  socketIO: {
    on: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
    use: jest.fn(),
  },

  uuid: "sample-uuid",

  Messenger: {
    init: jest.fn(),
    on: jest.fn(),
    unregisterCallback: jest.fn(),
  },

  FilterManager: {
    checkFilter: jest.fn(),
    update: jest.fn(),
  },

  ClientWrapper: {
    client: {
      createClient: jest.fn(),
      get: jest.fn((key: string, cb?: Callback<string> | undefined) => {
        if (cb) {
          cb(cbError, cbReply);
        }
      }),
      select: jest.fn(),
      setex: jest.fn(),
    },
    getConfig: jest.fn(),
    runScript: jest.fn(),
  },

  TopicManager: {
    getCreateTopic: jest.fn(),
  },

  socketSample: {
    disconnect: jest.fn(),
    emit: jest.fn(),
    handshake: {
      query: {
        subject: "sample",
        token: "sample-token",
      },
    },
    id: 0,
    join: jest.fn(),
    on: jest.fn(),
  },
};

/**
 * Mocks
 */
jest.genMockFromModule("redis");

jest.mock("socket.io", () => {
  return () => mockConfig.socketIO;
});

jest.mock("uuid/v4", () => {
  return () => mockConfig.uuid;
});

jest.mock("@dojot/dojot-module", () => ({
  Messenger: jest.fn(() => mockConfig.Messenger),
}));

jest.mock("../src/FilterManager", () => ({
  FilterManager: jest.fn(() => mockConfig.FilterManager),
}));

jest.mock("../src/RedisClientWrapper", () => ({
  ClientWrapper: jest.fn(() => mockConfig.ClientWrapper),
}));

jest.mock("../src/topicManager", () => ({
  TopicManager: jest.fn(() => mockConfig.TopicManager),
}));

describe("SocketIOHandler", () => {
  const messengerName = "testMessenger";
  const testEvent = "sample-event";
  const testTenant = "sample-tenant";
  const testToken = "sample-uuid";
  const testSubject = "device-data";
  const testTopic = "sample-topic";
  const testError = "generic-error";
  const testKey = `si:${testToken}`;
  const testSuccess = "sample-success";
  const testFailure = "sample-failure";
  const testCallbackId = "sample-callback-id";

  let handler: SocketIOHandler;
  let stripped: any;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new SocketIOHandler(new http.Server(), new Messenger(messengerName));
    stripped = handler as any;
  });

  describe("constructor", () => {
    it("should build an empty handler", (done) => {
      process.kill = jest.fn(() => {
        // Avoid application crash!
      });
      expect(handler).toBeDefined();
      expect(mockConfig.socketIO.use).toBeCalled();
      expect(mockConfig.socketIO.on).toHaveBeenCalledTimes(1);
      const connectEvent = mockConfig.socketIO.on.mock.calls[0][0];
      expect(connectEvent).toEqual("connection");

      done();
    });

    it("should successfully run the SocketIO connection callback", (done) => {
      const connectCallback = mockConfig.socketIO.on.mock.calls[0][1];

      // Running SocketIO connection callback
      connectCallback(mockConfig.socketSample);

      const disconnectEvent = mockConfig.socketSample.on.mock.calls[0][0];
      expect(disconnectEvent).toEqual("disconnect");
      expect(mockConfig.ClientWrapper.runScript).toBeCalledTimes(1);
      const [script, keys, vals, _redisCbk] = mockConfig.ClientWrapper.runScript.mock.calls[0];
      expect(script).toEqual(expect.stringContaining("/lua/setDel.lua"));
      expect(keys).toEqual(["si:sample-token"]);
      expect(vals).toEqual([]);

      done();
    });

    it("should successfully run the socket disconnection callback", (done) => {
      stripped.removeCallbacks = jest.fn();
      const connectCallback = mockConfig.socketIO.on.mock.calls[0][1];

      connectCallback(mockConfig.socketSample);
      const disconnectCallback = mockConfig.socketSample.on.mock.calls[0][1];

      // Running the socket disconnection callback
      disconnectCallback();

      expect(stripped.removeCallbacks).toBeCalledTimes(1);

      done();
    });

    it("should successfully run the Redis callback", (done) => {
      handler.processNewSocketIo = jest.fn();

      // Running SocketIO connection callback
      const connectCallback = mockConfig.socketIO.on.mock.calls[0][1];
      connectCallback(mockConfig.socketSample);

      // Retrieve runScript callback
      const redisCbk = mockConfig.ClientWrapper.runScript.mock.calls[0][3];
      expect(mockConfig.ClientWrapper.runScript).toBeCalledTimes(1);

      redisCbk(null, "sample-tenant");
      expect(handler.processNewSocketIo).toHaveBeenCalled();
      done();
    });

    it("should fail when running the Redis callback", (done) => {
      handler.processNewSocketIo = jest.fn();

      // Running SocketIO connection callback
      const connectCallback = mockConfig.socketIO.on.mock.calls[0][1];
      connectCallback(mockConfig.socketSample);

      // Retrieve runScript callback
      const redisCbk = mockConfig.ClientWrapper.runScript.mock.calls[0][3];
      expect(mockConfig.ClientWrapper.runScript).toBeCalledTimes(1);

      redisCbk("error", "sample-tenant");
      expect(mockConfig.socketSample.disconnect).toBeCalledTimes(1);
      done();
    });
  });

  describe("processNewSocketIo", () => {
    it("should process a new regular socket.io connection", () => {
      handler.registerSocketIoNotification = jest.fn();
      mockConfig.socketSample.handshake.query.subject = "sample-subject";
      handler.processNewSocketIo(mockConfig.socketSample as any, "sample-tenant");
      expect(mockConfig.socketSample.join).toHaveBeenCalled();
      expect(handler.registerSocketIoNotification).not.toHaveBeenCalled();
    });

    it("should process a new notification socket.io connection", () => {
      handler.registerSocketIoNotification = jest.fn();
      mockConfig.socketSample.handshake.query.subject = "dojot.notifications";
      handler.processNewSocketIo(mockConfig.socketSample as any, "sample-tenant");
      expect(mockConfig.socketSample.join).not.toHaveBeenCalled();
      expect(handler.registerSocketIoNotification).toHaveBeenCalled();
    });
  });

  describe("registerSocketIoNotification", () => {
    it("should register a new SocketIO notification connection", () => {
      stripped.registerCallback = jest.fn();

      handler.registerSocketIoNotification(mockConfig.socketSample as any, "sample-tenant");

      const [subject, event, _onCbk] = stripped.registerCallback.mock.calls[0];
      expect(subject).toEqual("dojot.notifications");
      expect(event).toEqual("message");
    });

    it("should successfully run the registerCallback callback", () => {
      mockConfig.FilterManager.checkFilter.mockReturnValue(true);
      stripped.registerCallback = jest.fn();

      handler.registerSocketIoNotification(mockConfig.socketSample as any, "sample-tenant");

      const [_subject, _event, onCbk] = stripped.registerCallback.mock.calls[0];
      onCbk("sample-tenant", "sample-msg");
      expect(mockConfig.FilterManager.checkFilter).toBeCalled();
      expect(mockConfig.socketSample.emit).toHaveBeenCalled();
    });

    it("should not emit a message to notification because filter does not apply to it", () => {
      mockConfig.FilterManager.checkFilter.mockReturnValue(false);
      stripped.registerCallback = jest.fn();

      handler.registerSocketIoNotification(mockConfig.socketSample as any, "sample-tenant");

      const [_subject, _event, onCbk] = stripped.registerCallback.mock.calls[0];
      onCbk("sample-tenant", "sample-msg");
      expect(mockConfig.FilterManager.checkFilter).toBeCalled();
      expect(mockConfig.socketSample.emit).not.toHaveBeenCalled();
    });

    it("should not emit message because the tenant is not the right one", () => {
      mockConfig.FilterManager.checkFilter.mockReturnValue(true);
      stripped.registerCallback = jest.fn();

      handler.registerSocketIoNotification(mockConfig.socketSample as any, "sample-tenant");

      const [_subject, _event, onCbk] = stripped.registerCallback.mock.calls[0];
      onCbk("sample-tenant-2", "sample-msg");
      expect(mockConfig.FilterManager.checkFilter).not.toHaveBeenCalled();
      expect(mockConfig.socketSample.emit).not.toHaveBeenCalled();
    });

    it("should successfully call the SocketIO callback with a filter", () => {
      mockConfig.FilterManager.update = jest.fn();

      handler.registerSocketIoNotification(mockConfig.socketSample as any, "sample-tenant");

      expect(mockConfig.socketSample.on).toHaveBeenCalled();

      const [event, sioCallback] = mockConfig.socketSample.on.mock.calls[0];
      expect(event).toBe("filter");

      const filter = JSON.stringify({
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      });

      sioCallback(filter);

      const [filterJson, socketId] = mockConfig.FilterManager.update.mock.calls[0];
      expect(filterJson).toEqual(JSON.parse(filter));
      expect(socketId).toBe(mockConfig.socketSample.id);
    });
  });

  describe("getToken", () => {
    let token: string;

    beforeEach(() => {
      logger.error = jest.fn();
      token = handler.getToken(testTenant);
    });

    it("should return a correct token", () => {
      expect(mockConfig.TopicManager.getCreateTopic).toBeCalledTimes(1);

      // Retrieve redis calls
      expect(mockConfig.ClientWrapper.client.setex).toBeCalledTimes(1);
      const [key, time, tenant] = mockConfig.ClientWrapper.client.setex.mock.calls[0];
      expect(key).toEqual(testKey);
      expect(time).toEqual(60);
      expect(tenant).toEqual(testTenant);

      expect(token).toEqual(testToken);
    });

    it("should call getCreateTopic callback successfuly", (done) => {
      // Retrieve getCreateTopic call
      const [subject, callback] = mockConfig.TopicManager.getCreateTopic.mock.calls[0];
      expect(subject).toEqual(testSubject);

      callback(undefined, testTopic);

      expect(logger.error).not.toHaveBeenCalled();

      done();
    });

    it("should call getCreateTopic callback with error", () => {
      // Retrieve getCreateTopic call
      const [_subject, callback] = mockConfig.TopicManager.getCreateTopic.mock.calls[0];

      callback(testError);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("registerCallback", () => {
    it("should register a callback for a subject that is not already registered", () => {
      stripped.registeredCallbacks.get = jest.fn(() => { return undefined });
      stripped.registeredCallbacks.set = jest.fn();
      mockConfig.Messenger.on = jest.fn(() => { return "sample-callback-id" });

      stripped.registerCallback(testSubject, testEvent, jest.fn(), testToken);

      expect(stripped.registeredCallbacks.get).toHaveBeenCalledWith(testSubject);
      expect(stripped.registeredCallbacks.get).toReturnWith(undefined);
      expect(mockConfig.Messenger.on).toHaveBeenCalledWith(testSubject, testEvent, expect.any(Function));
      expect(mockConfig.Messenger.on).toReturnWith("sample-callback-id");
      expect(stripped.registeredCallbacks.set).toHaveBeenCalledWith(
        testSubject,
        { event: testEvent, callbackId: "sample-callback-id", token: testToken });
    });

    it("should not register a callback for a subject that is already registered", () => {
      stripped.registeredCallbacks.get = jest.fn(() => { return {} });
      stripped.registeredCallbacks.set = jest.fn();
      logger.debug = jest.fn();

      stripped.registerCallback(testSubject, testEvent, jest.fn(), testToken);

      expect(stripped.registeredCallbacks.get).toHaveBeenCalledWith(testSubject);
      expect(stripped.registeredCallbacks.get).toReturnWith(expect.anything());
      expect(mockConfig.Messenger.on).not.toHaveBeenCalled();
      expect(stripped.registeredCallbacks.set).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe("removeCallbacks", () => {
    it("should remove the registered callback", () => {
      stripped.registeredCallbacks.forEach = jest.fn();
      stripped.registeredCallbacks.delete = jest.fn();

      stripped.removeCallbacks(testToken);

      expect(stripped.registeredCallbacks.forEach).toHaveBeenCalled();
      const [ callback ] = stripped.registeredCallbacks.forEach.mock.calls[0];
      callback({ event: testEvent, callbackId: testCallbackId, token: testToken }, testSubject);
      expect(mockConfig.Messenger.unregisterCallback).toHaveBeenCalledWith(testSubject, testEvent, testCallbackId);
      expect(stripped.registeredCallbacks.delete).toHaveBeenCalledWith(testSubject);
    });

    it("should not remove the registered callback that does not have a matching token", () => {
      stripped.registeredCallbacks.forEach = jest.fn();
      stripped.registeredCallbacks.delete = jest.fn();

      stripped.removeCallbacks(testToken);

      expect(stripped.registeredCallbacks.forEach).toHaveBeenCalled();
      const [ callback ] = stripped.registeredCallbacks.forEach.mock.calls[0];
      callback({ event: testEvent, callbackId: testCallbackId, token: testToken + "-1" }, testSubject);
      expect(mockConfig.Messenger.unregisterCallback).not.toHaveBeenCalled();
      expect(stripped.registeredCallbacks.delete).not.toHaveBeenCalled();
    });
  });

  describe("handleMessage", () => {
    let testMessage: any;

    beforeEach(() => {
      testMessage = undefined;
    });

    it("should handle a complete message", () => {
      testMessage = {
        attrs: {
          humidity: 60,
        },
        metadata: {
          deviceid: "c6ea4b",
          tenant: "admin",
          timestamp: 1528226137452,
        },
      };
      stripped.handleMessage(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).toHaveBeenCalledTimes(2);
    });

    it("should not handle an incomplete message", () => {
      // without metadata
      testMessage = {
        attrs: {
          humidity: 60,
        },
        meta: {
          deviceid: "c6ea4b",
          tenant: "admin",
          timestamp: 1528226137452,
        },
      };
      stripped.handleMessage(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // metadata without deviceid
      testMessage = {
        attrs: {
          humidity: 60,
        },
        metadata: {
          tenant: "admin",
          timestamp: 1528226137452,
        },
      };
      stripped.handleMessage(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // invalid message
      testMessage = {};
      stripped.handleMessage(testTenant, testMessage);
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });
  });

  describe("handleMessageActuator", () => {
    let testMessage: any;

    beforeEach(() => {
      testMessage = undefined;
    });

    it("should handle a complete actuation message", () => {
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).toHaveBeenCalledTimes(2);
    });

    it("should not handle an invalid actuation message", () => {
      testMessage = {};
      stripped.handleMessageActuator(testTenant, testMessage);
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });

    it("should not handle an incomplete actuation message - property event", () => {
      // event is not configure
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "not-configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without event
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });

    it("should not handle an incomplete actuation message - property meta", () => {
      // without service
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
        meta: {
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without timestamp
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without meta
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });

    it("should not handle an incomplete actuation message - property data", () => {
      // without id
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without attrs
      testMessage = {
        data: {
          id: "efac",
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without data
      testMessage = {
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });
  });

  describe("checkSocket", () => {
    const next = jest.fn((error?: Error) => {
      if (error) {
        throw new Error(testError);
      }
      return testSuccess;
    });

    let socket: any;

    beforeEach(() => {
      socket = undefined;
    });

    it("should succeed checking a socket", () => {
      socket = {
        handshake: {
          query: {
            token: testToken,
          },
        },
      };
      cbError = null;
      cbReply = `${testSuccess}-callback`;

      expect(() => stripped.checkSocket(socket, next)).not.toThrow();
    });

    it("should not succeed checking a socket", () => {
      /* without token */
      socket = {
        handshake: {
          query: {},
        },
      };
      cbError = null;
      cbReply = `${testSuccess}-callback`;

      expect(() => stripped.checkSocket(socket, next)).toThrow();

      /* redis.client.get returns error */
      socket = {
        handshake: {
          query: {
            token: testToken,
          },
        },
      };
      cbError = new Error();
      cbReply = testFailure;

      expect(() => stripped.checkSocket(socket, next)).toThrow();

      /* redis.client.get returns invalid token */
      cbError = null;
      cbReply = "";

      expect(() => stripped.checkSocket(socket, next)).toThrow();

      /* invalid socket */
      socket = undefined;
      expect(() => stripped.checkSocket(socket, next)).toThrow();
    });
  });
});
