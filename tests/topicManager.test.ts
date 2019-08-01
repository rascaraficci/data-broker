/* jslint node: true */
"use strict";

import "jest";
import { TopicManager } from "../src/topicManager";

const sampleConfig: object = {
  "special-user": {
    replica_assignment: {
      1: [ 1, 2, 3 ],
      2: [ 4, 5, 6 ],
    },
  },
};

jest.mock("../src/RedisClientWrapper", () => ({
  ClientWrapper: jest.fn(() => {
    return {
      getConfig: jest.fn(() => new Promise((resolve, reject) => {
        resolve(sampleConfig);
      })),
      setConfig: jest.fn(),
    };
  }),
}));

describe("TopicManager", () => {
  let topicManager: TopicManager;

  beforeEach(() => {
    topicManager = new TopicManager("test");
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
  });

  describe("getConfigTopics", () => {
    it("should get config - valid subject", () => {
      expect.assertions(1);

      topicManager.getConfigTopics("test").then((data) => {
        expect(data).toBeDefined();
      });
    });

    it("should not get config - invalid subject", () => {
      expect(() => topicManager.getConfigTopics("")).toThrow();
    });
  });

  describe("setConfigTopics", () => {
    it("should set a topic config - valid subject", () => {
      expect(() => topicManager.setConfigTopics("test", sampleConfig)).not.toThrow();
    });

    it("should not set a topic config - invalid subject", () => {
      expect(() => topicManager.setConfigTopics("", sampleConfig)).toThrow();
    });
  });

  describe("editConfigTopics", () => {
    it("should edit a topic config", () => {
      expect(() => topicManager.editConfigTopics("test", "special-user", sampleConfig)).not.toThrow();
    });

    it("should not edit a topic config - invalid subject", () => {
      expect(() => topicManager.editConfigTopics("", "special-user", sampleConfig)).toThrow();
    });

    it("should not edit a topic config - invalid tenant", () => {
      expect(() => topicManager.editConfigTopics("test", "", sampleConfig)).toThrow();
    });
  });

  describe("getCreateTopic", () => {
    it("should create a topic - with callback", () => {
      expect(() => topicManager.getCreateTopic("test", () => {
        // do nothing
      })).toBeDefined();
    });

    it("should create a topic - without callback", () => {
      expect(() => topicManager.getCreateTopic("test", undefined)).toBeDefined();
    });
  });
});
