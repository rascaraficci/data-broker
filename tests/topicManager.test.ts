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

describe("TopicManager", () => {
  let topicManager: TopicManager;

  beforeEach(() => {
    topicManager = new TopicManager("test");
  });

  // constructor() tests //
  it("should create a TopicManager", () => {
    expect(topicManager).toBeDefined();
  });

  it("should not create a TopicManager", () => {
    expect(() => new TopicManager("")).toThrow();
  });

  // getCreateTopic() tests //
  it("should create a topic", () => {
    expect(() => topicManager.getCreateTopic("test", undefined)).toBeDefined();
  });

  // setConfigTopics() tests //
  it("should set a topic config with non empty body", () => {
    expect(() => {
      topicManager.setConfigTopics("", sampleConfig);
    }).toThrow();
  });
});
