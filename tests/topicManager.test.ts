/* jslint node: true */
"use strict";

import "jest";
import { KafkaFactory } from "../src/KafkaFactory";
import { TopicManager } from "../src/topicManager";

// Used to test the KafkaProducer callback
let kafkaProducerInit: undefined | Function = undefined;

/**
 * Mocks
 */
jest.mock("../src/KafkaFactory", () => ({
  KafkaFactory: jest.fn(() => mockConfig.KafkaFactory),
}));

jest.mock("../src/producer", () => ({
  KafkaProducer: jest.fn((kafkaFactory: KafkaFactory, init: () => void) => {
    init();
    kafkaProducerInit = init;
    return mockConfig.KafkaProducer;
  }),
}));

jest.mock("../src/RedisClientWrapper", () => ({
  ClientWrapper: jest.fn(() => mockConfig.ClientWrapper),
}));

jest.mock("redis", () => ({
  createClient: jest.fn(() => {
    return {};
  }),
}));

/**
 * Variables used in the tests
 */
// Mock configuration
const mockConfig = {
  ClientWrapper: {
    getConfig: jest.fn(() => new Promise((resolve, reject) => {
      resolve(sampleConfig);
    })),
    runScript: jest.fn(
      (path: string, keys: string[], vals: string[], callback: (error: any, data: any) => void) => {
        callback(callbackError, callbackData);
    }),
    setConfig: jest.fn(),
  },

  KafkaFactory: {
    client: jest.fn(),
    dojotProducer: jest.fn(),
    kafkaProducer: jest.fn(),
  },

  KafkaProducer: {
    close: jest.fn(),
    createTopic: jest.fn(),
    createTopics: jest.fn(),
    send: jest.fn(),
  },
};

let sampleConfig: object | undefined = {
  testService: {
    replica_assignment: {
      1: [ 1, 2, 3 ],
      2: [ 4, 5, 6 ],
    },
  },
};
// Variables to modify ClientWrapper.runScript callback behaviour
// This is kinda ugly, but I could not find another way to modify the callback parameters
let callbackError: string | undefined;
let callbackData: string | undefined;

/**
 * TopicManager tests
 */
describe("TopicManager", () => {
  let topicManager: TopicManager;
  let stripped: any;
  const testService: string = "testService";

  beforeEach(() => {
    topicManager = new TopicManager(testService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    topicManager.destroy();
  });

  describe("constructor", () => {
    it("should create a TopicManager - valid service", () => {
      expect(topicManager).toBeDefined();
    });

    it("should not create a TopicManager - invalid service", () => {
      expect(() => new TopicManager("")).toThrow();
    });

    it("should call handleRequest inside the init function", () => {
      if (kafkaProducerInit !== undefined) {
        stripped = topicManager as any;
        stripped.topicQueue = [{}];
        stripped.handleRequest = jest.fn();

        kafkaProducerInit();

        expect(stripped.handleRequest).toBeCalledTimes(1)
      } else {
        fail("init is undefined")
      }
    });
  });

  describe("createTopic", () => {
    const testCallback = jest.fn();
    const testSubject: string = "testSubject";

    it("should create a topic", async () => {
      callbackError = undefined;
      callbackData = "testData";
      expect(() => topicManager.createTopic(testSubject, testCallback)).not.toThrow();
    });

    it("should add a pending request to the queue", () => {
      callbackError = undefined;
      callbackData = "testData";

      stripped = (topicManager as any);
      stripped.producerReady = false;
      const beforeLength = stripped.topicQueue.length;
      expect(() => stripped.createTopic(testSubject, testCallback)).not.toThrow();
      const afterLength = stripped.topicQueue.length;
      // If producer is not ready, it will queue the requests, so we need to check whether
      // the length of the list has changed by one
      expect(beforeLength).toEqual(afterLength - 1);
    });

    it("should not create a topic - exception thrown", () => {
      callbackError = "testError";
      callbackData = undefined;

      stripped = topicManager as any;
      stripped.handleRequest = jest.fn(() => { throw new Error() });

      topicManager.createTopic(testSubject, testCallback);

      expect(testCallback).toBeCalledTimes(1);
    });
  });

  describe("assertTopic", () => {
    beforeEach(() => {
      stripped = (topicManager as any);
    });

    it("should assert the topic", () => {
      expect(() => stripped.assertTopic("testTopic", "testErrorMessage")).not.toThrow();
    });

    it("should not assert the topic", () => {
      expect(() => stripped.assertTopic("", "testErrorMessage")).toThrow();
    });
  });

  describe("createTopicName", () => {
    beforeEach(() => {
      stripped = (topicManager as any);
    });

    it("should create the topic name", () => {
      const testSubject = "testSubject";
      expect(stripped.createTopicName(testSubject)).toEqual(`${testService}.${testSubject}`);
    });

    it("should not create the topic name", () => {
      expect(() => stripped.createTopicName("")).toThrow();
    });
  });

  describe("handleRequest", () => {
    const testCallback = jest.fn();
    const testRequest = {
      callback: testCallback,
      subject: "testSubject",
      topic: "testTopic",
    };
    const testConfig: object = {
      "*": {
        replica_assignment: {
          1: [ 1, 2, 3 ],
          2: [ 4, 5, 6 ],
        },
      },
    };

    let originalSampleConfig: object;

    beforeEach(() => {
      originalSampleConfig = Object.assign({}, sampleConfig);
      stripped = (topicManager as any);
    });

    afterEach(() => {
      sampleConfig = originalSampleConfig;
    });

    it("should handle a request - data with service name", async () => {
      await stripped.handleRequest(testRequest);
      expect(mockConfig.KafkaProducer.createTopic).toHaveBeenCalledTimes(1);
    });

    it("should handle a request - data with generic service name", async () => {
      sampleConfig = Object.assign({}, testConfig);
      await stripped.handleRequest(testRequest);
      expect(mockConfig.KafkaProducer.createTopic).toHaveBeenCalledTimes(1);
    });

    it("should handle a request - data with another service name", async () => {
      sampleConfig = { anotherService: {} };
      await stripped.handleRequest(testRequest);
      expect(mockConfig.KafkaProducer.createTopic).toHaveBeenCalledTimes(1);
    });
  });
});
