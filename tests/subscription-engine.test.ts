/* jslint node: true */
"use strict";

import "jest";
import kafka from "kafka-node";
import { KafkaFactory } from "../src/KafkaFactory";
import { SubscriptionEngine, SubscriptionType } from "../src/subscription-engine";
import { Notification } from "../src/subscription/Notification";
import { Subscription } from "../src/subscription/Subscription";

jest.mock("../src/consumer", () => ({
  KafkaConsumer: jest.fn(() => {
    return { subscribe: jest.fn() };
  }),
}));

jest.mock("../src/producer", () => ({
  KafkaProducer: jest.fn((kafkaFactory: KafkaFactory, init: () => void) => {
    init();
    return {
      close: jest.fn(),
      createTopic: jest.fn(),
      createTopics: jest.fn(),
      send: jest.fn(),
    };
  }),
}));

jest.mock("../src/subscription/Notification", () => ({
  Notification: jest.fn(() => {
    return {
      attrs: [],
      topic: "",
    };
  }),
}));

jest.mock("../src/subscription/Subscription", () => ({
  Subscription: jest.fn(() => {
    return {
      id: "testId",
      subject: {
        entities: {
          id: "testEntityId",
        },
      },
    };
  }),
}));

jest.mock("../src/KafkaFactory", () => ({
  KafkaFactory: jest.fn(() => {
    return {
      client: jest.fn(),
      dojotProducer: jest.fn(),
      kafkaProducer: jest.fn(),
    };
  }),
}));

jest.mock("../src/subscription/Event", () => ({
  Event: jest.fn(() => {
    return {
      attrs: {},
      metadata: {
        deviceid: "testDeviceId",
        model: "testModel",
        payload: "testPayload",
        protocol: "testProtocol",
        topic: "testTopic",
        type: "testType",
      },
    };
  }),
}));

describe("SubscriptionEngine class", () => {
  let subscriptionEngine: SubscriptionEngine;

  beforeEach(() => {
    subscriptionEngine = new SubscriptionEngine();
  });

  describe("constructor", () => {
    it("should build a SubscriptionEngine", () => {
      const engine = new SubscriptionEngine()
      expect(engine).toBeDefined();

      const strippedObj = (engine as any);
      expect(strippedObj.producer).toBeDefined();
      expect(strippedObj.producerReady).toBeTruthy();
      expect(strippedObj.subscriber).toBeDefined();
      expect(strippedObj.registeredSubscriptions).toBeDefined();
    });
  });

  describe("handleEvent", () => {
    let message: kafka.Message;
    let parseSpy: jest.SpyInstance;

    beforeAll(() => {
      message = { topic: "testTopic", value: "{ \"data\": \"testValue\" }" };
      parseSpy = jest.spyOn(JSON, "parse");
    });

    beforeEach(() => {
      parseSpy.mockClear();
    });

    it("should handle the event", () => {
      subscriptionEngine.handleEvent(undefined, message);
      expect(() => parseSpy).not.toThrow();
    });

    it("should not handle the event - with err", () => {
      subscriptionEngine.handleEvent("testError", message);
      expect(parseSpy).not.toBeCalled();
    });

    it("should not handle the event - without message", () => {
      subscriptionEngine.handleEvent(undefined, undefined);
      expect(parseSpy).not.toBeCalled();
    });
  });

  describe("addIngestionChannel", () => {
    it("should add one ingestion channel", () => {
      expect(() => subscriptionEngine.addIngestionChannel( ["testChannel1"] )).not.toThrow();
    });

    it("should add two ingestion channels", () => {
      expect(() => subscriptionEngine.addIngestionChannel( ["testChannel1", "testChannel2"] )).not.toThrow();
    });
  });

  describe("addSubscription", () => {
    let subscription: Subscription;

    beforeEach(() => {
      subscription = new Subscription();
    });

    it("it should add a new subscription - with notification", () => {
      subscription.notification = new Notification();
      expect(() => subscriptionEngine.addSubscription(SubscriptionType.id, "testKey", subscription)).not.toThrow();
    });

    it("it should add a new subscription - without notification", () => {
      expect(() => subscriptionEngine.addSubscription(SubscriptionType.id, "testKey", subscription)).not.toThrow();
    });

    it("it should add two subscriptions of the same type - with notification", () => {
      subscription.notification = new Notification();
      expect(() => subscriptionEngine.addSubscription(SubscriptionType.id, "testKey", subscription)).not.toThrow();
      expect(() => subscriptionEngine.addSubscription(SubscriptionType.id, "testKey", subscription)).not.toThrow();
    });

    it("it should add two subscriptions of the same type - without notification", () => {
      expect(() => subscriptionEngine.addSubscription(SubscriptionType.id, "testKey", subscription)).not.toThrow();
      expect(() => subscriptionEngine.addSubscription(SubscriptionType.id, "testKey", subscription)).not.toThrow();
    });
  });
});
