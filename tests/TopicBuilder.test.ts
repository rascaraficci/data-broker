/* jslint node: true */
"use strict";

import "jest";
import { TopicManagerBuilder } from "../src/TopicBuilder";

describe("TopicBuilder", () => {
  let topicBuilder = TopicManagerBuilder;

  it("should build a new service - valid name", () => {
    expect(topicBuilder.get("testService1")).toBeDefined();
  });

  it("should retrieve an already created service", () => {
    const manager = topicBuilder.get("testService2");
    expect(manager).toBeDefined();

    const retrievedManager = topicBuilder.get("testService2");
    expect(retrievedManager).toBeDefined();

    expect(manager).toBe(retrievedManager);
  });

  it("should not build a new service - invalid name", () => {
    expect(() => topicBuilder.get("")).toThrow();
  });
});
