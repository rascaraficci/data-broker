/* jslint node: true */
"use strict";

import { AgentHealthChecker } from "../src/Healthcheck";

import { Messenger } from "@dojot/dojot-module";
import { Collector, DataTrigger, IComponentDetails, ServiceStatus } from "@dojot/healthcheck";

import "jest";
import os from "os";
import { RedisClient } from "redis";

/**
 * Variables
 */
/* HealthChecker */
const mockServiceStatus: ServiceStatus = "pass";
const mockServiceInfoDynamic = {
  status: mockServiceStatus,
};

const mockTrigger = new DataTrigger(mockServiceInfoDynamic, {});

// To test the registerMonitor callback, we call it directly in the mocked registerMonitor function
const mockRegisterMonitor = jest.fn((monitor: IComponentDetails, collectFn?: Collector, periodicity?: number) => {
  if (collectFn) return collectFn(mockTrigger);
});

/* Mocked/Spied functions */
const mockConfig = {
  process: {
    uptime: jest.spyOn(process, "uptime").mockReturnValue(42),
  },
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
  getHTTPRouter: jest.fn(() => ({})),
  DataTrigger: jest.fn(() => ({
    trigger: jest.fn(),
  })),
  HealthChecker: jest.fn(() => mockConfig.HealthChecker),
  Router: jest.fn(),
}));

jest.mock("os", () => ({
  // We need to redefine the EOL symbol, otherwise the log messages will
  // be diplayed in the same line, with an "undefined" written where it should
  // be an "\n"
  EOL: "\n",
  cpus: jest.fn().mockReturnThis(),
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

  afterEach(() => {
    jest.clearAllMocks();
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

  /**
   * Monitors tests
   */
  describe("Monitors", () => {
    const spyTrigger: jest.SpyInstance = jest.spyOn(mockTrigger, "trigger");

    it("should register monitors", () => {
      hc.init();
      expect(mockConfig.HealthChecker.registerMonitor).toHaveBeenCalledTimes(5);
    });

    /**
     * Uptime monitor
     */
    describe("Uptime", () => {
      it("should correctly collect uptime", () => {
        stripped._registerUptimeMonitor();

        expect(mockConfig.process.uptime).toHaveBeenCalled();
        expect(spyTrigger.mock.calls[0]).toEqual([expect.any(Number), "pass"]);
      });
    });

    /**
     * Memory Monitor
     */
    describe("Memory", () => {
      let spyTotalmem: jest.SpyInstance;
      let spyFreemem: jest.SpyInstance;

      beforeAll(() => {
        spyFreemem = jest.spyOn(os, "freemem");
        spyTotalmem = jest.spyOn(os, "totalmem");
      });

      it("should trigger warn - memory usage is high", () => {
        spyFreemem.mockReturnValue(20);

        stripped._registerMemoryMonitor();

        expect(spyTotalmem).toHaveBeenCalled();
        expect(spyFreemem).toHaveBeenCalled();
        expect(spyTrigger.mock.calls[0]).toEqual([expect.any(Number), "warn"]);
      });

      it("should trigger pass - memory usage is normal", () => {
        spyFreemem.mockReturnValue(80);

        stripped._registerMemoryMonitor();

        expect(spyTotalmem).toHaveBeenCalled();
        expect(spyFreemem).toHaveBeenCalled();
        expect(spyTrigger.mock.calls[0]).toEqual([expect.any(Number), "pass"]);
      });
    });

    /**
     * CPU Monitor
     */
    describe("CPU", () => {
      // The values do not matter at all, but the structure does
      const cpuInfo: os.CpuInfo = {
        model: "testModel",
        speed: 1,
        times: {
          idle: 1,
          irq: 1,
          nice: 1,
          sys: 1,
          user: 1,
        },
      };
      let spyCpus: jest.SpyInstance;
      let spyLoadavg: jest.SpyInstance;

      beforeAll(() => {
        spyCpus = jest.spyOn(os, "cpus");
        spyLoadavg = jest.spyOn(os, "loadavg");
      });

      it("should trigger pass - CPU usage is normal", () => {
        spyCpus.mockReturnValue([cpuInfo, cpuInfo]);

        stripped._registerCpuMonitor();

        expect(spyCpus).toHaveBeenCalled();
        expect(spyLoadavg).toHaveBeenCalled();
        expect(spyTrigger.mock.calls[0]).toEqual([expect.any(Number), "pass"]);
      });

      it("should trigger warn - CPU usage is high", () => {
        spyCpus.mockReturnValue([cpuInfo]);

        stripped._registerCpuMonitor();

        expect(spyCpus).toHaveBeenCalled();
        expect(spyLoadavg).toHaveBeenCalled();
        expect(spyTrigger.mock.calls[0]).toEqual([expect.any(Number), "warn"]);
      });
    });

    /**
     * Redis Monitor
     */
    describe("Redis", () => {
      beforeAll(() => {
        mockConfig.HealthChecker.registerMonitor = jest.fn(
          (monitor: IComponentDetails, collectFn?: Collector, periodicity?: number) => {
            return mockTrigger;
          });
      });

      afterAll(() => {
        // Restoring the original mocked functions
        mockConfig.RedisClient.on = jest.fn();
        mockConfig.HealthChecker.registerMonitor = mockRegisterMonitor;
      });

      it("should trigger pass - Redis server connected", () => {
        // Testing the "ready" event that should trigger "pass"
        mockConfig.RedisClient.on = jest.fn((event: string, listener: (...args: any[]) => void) => {
          if (event === "ready") {
            listener();
          }
        });
        stripped._registerRedisMonitor();

        expect(spyTrigger.mock.calls[0]).toEqual([true, "pass"]);
      });

      it("should trigger fail - Redis connection has closed", () => {
        // Testing the "ready" event that should trigger "fail"
        mockConfig.RedisClient.on = jest.fn((event: string, listener: (...args: any[]) => void) => {
          if (event === "end") {
            listener();
          }
        });
        stripped._registerRedisMonitor();

        expect(spyTrigger.mock.calls[0]).toEqual([false, "fail"]);
      });
    });

    /**
     * Kafka Monitor
     */
    describe("Kafka", () => {
      let spyPromise: jest.SpyInstance;

      beforeEach(() => {
        spyPromise = jest.spyOn(stripped, "_getKafkaStatus");
      });

      afterAll(() => {
        spyPromise.mockRestore();
      });

      it("should get Kafka status", () => {
        mockConfig.Messenger.consumer.consumer.getMetadata.mockImplementation(
          (metadataOptions: any, cb?: (err: any, data: any) => any) => {
          if (cb) {
            cb(undefined, "testMetadata");
          }
        });

        const status = stripped._getKafkaStatus();

        expect(stripped._getKafkaStatus).toHaveBeenCalled();
        expect(status).resolves.toEqual({ connected: true, details: { metadata: "testMetadata" } });
      });

      it("should not get Kafka status", () => {
        mockConfig.Messenger.consumer.consumer.getMetadata.mockImplementation(
          (metadataOptions: any, cb?: (err: any, data: any) => any) => {
            if (cb) {
              cb("testError", undefined);
            }
          });

        const status = stripped._getKafkaStatus();

        expect(stripped._getKafkaStatus).toHaveBeenCalled();
        expect(status).rejects.toEqual("testError");
      });

      it("should trigger pass - Kafka is connected", async () => {
        spyPromise.mockImplementationOnce(() => {
          return new Promise((resolve, reject) => {
            resolve({ connected: true });
          });
        });

        stripped._registerKafkaMonitor();
        await spyPromise;

        expect(spyTrigger.mock.calls[0]).toEqual([1, "pass"]);
      });

      it("should trigger fail - Kafka is not connected", async () => {
        spyPromise.mockImplementationOnce(() => {
          return new Promise((resolve, reject) => {
            resolve({ connected: false });
          });
        });

        stripped._registerKafkaMonitor();
        await spyPromise;

        expect(spyTrigger.mock.calls[0]).toEqual([0, "fail"]);
      });

      it("should trigger fail - promise was rejected", () => {
        spyPromise.mockImplementationOnce(() => {
          return new Promise((resolve, reject) => {
            reject("testError");
          });
        });

        try {
          stripped._registerKafkaMonitor();
        } catch {
          expect(spyTrigger).toHaveBeenCalled();
          expect(spyTrigger).toHaveBeenCalledWith([0, "fail", "testError"]);
        }
      });
    });
  });
});
