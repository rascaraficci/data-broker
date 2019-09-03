/* jslint node: true */
"use strict";
import { Messenger } from "@dojot/dojot-module";
import "jest";
import { RedisClient } from "redis";
import { AgentHealthChecker } from "../src/Healthcheck";
import { DataTrigger, ServiceStatus, IComponentDetails, Collector } from "@dojot/healthcheck";
import os from "os";

/**
 * Variables
 */
/* HealthChecker */
let mockServiceStatus: ServiceStatus = "pass";
const mockServiceInfoDynamic = {
  status: mockServiceStatus,
}
let mockTrigger = new DataTrigger(mockServiceInfoDynamic, {});
// To test the registerMonitor callback, we call it directly in the mocked registerMonitor function
const mockRegisterMonitor = jest.fn((monitor: IComponentDetails, collectFn?: Collector, periodicity?: number) => {
  if (collectFn) return collectFn(mockTrigger);
});

/* Mocked/Spied functions */
const mockConfig = {
  HealthChecker: {
    registerMonitor: mockRegisterMonitor,
  },
  Messenger: {
    consumer: {
      consumer: {
        getMetadata: jest.fn(),
      },
    },
  },
  process: {
    uptime: jest.spyOn(process, "uptime").mockReturnValue(42),
  },
  RedisClient: {
    on: jest.fn(),
  },
  Router: jest.fn(),
};

/**
 * Mocks
 */
jest.mock("@dojot/dojot-module", () => ({
  Messenger: jest.fn(() => mockConfig.Messenger),
}));

jest.mock("@dojot/healthcheck", () => ({
  DataTrigger: jest.fn(() => ({
    trigger: jest.fn(),
  })),
  HealthChecker: jest.fn(() => mockConfig.HealthChecker),
  Router: jest.fn(),
  getHTTPRouter: jest.fn(() => ({})),
}));

jest.mock("os", () => ({
  cpus: jest.fn().mockReturnThis(),
  // We need to redefine the EOL symbol, otherwise the log messages will
  // be diplayed in the same line, with an "undefined" written where it should
  // be an "\n"
  EOL: "\n",
  freemem: jest.fn(),
  loadavg: jest.fn().mockReturnValue([1, 1.1]),
  totalmem: jest.fn().mockReturnValue(100),
  uptime: jest.fn(),
}));

jest.mock("redis", () => ({
  RedisClient: jest.fn(() => mockConfig.RedisClient),
}));

jest.mock("node-rdkafka");
jest.mock("process");

describe("AgentHealthCheck", () => {
  let messenger: Messenger;
  let redisClient: RedisClient;
  let hc: AgentHealthChecker;
  let stripped: any;

  beforeEach(() => {
    messenger = new Messenger("testMessenger");
    redisClient = new RedisClient({});
    hc = new AgentHealthChecker(messenger, redisClient);
    stripped = (hc as any);
  });

  it("should build an AgentHealthCheck", () => {
    expect(hc).toBeDefined();
    expect(hc.router).toBeDefined();

    expect(stripped.healthChecker).toBeDefined();
    expect(stripped.kafkaMessenger).toBeDefined();
    expect(stripped.kafkaMessenger).toBe(messenger);
    expect(stripped.redisClient).toBeDefined();
    expect(stripped.redisClient).toBe(redisClient);
  });

  it("should register monitors", () => {
    hc.init();
    expect(mockConfig.HealthCheck.registerMonitor).toHaveBeenCalledTimes(5);
  });
});
