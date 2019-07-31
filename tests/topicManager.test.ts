/* jslint node: true */
"use strict";

import "jest";
import { TopicManager } from "../src/topicManager";

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
});
