import "jest";
import { ClientWrapper } from "../src/RedisClientWrapper";

class RedisClientStub {
  public evalsha: jest.Mock;
  public get: jest.Mock;
  public scan: jest.Mock;
  public script: jest.Mock;
  public select: jest.Mock;
  public set: jest.Mock;

  constructor() {
    this.evalsha = jest.fn();
    this.get = jest.fn();
    this.scan = jest.fn();
    this.script = jest.fn((arg1: any, arg2: any, cb?: any) => {
      if (cb) {
        // to test the callback code
        cb();
      }
    });
    this.select = jest.fn();
    this.set = jest.fn();
  }
}

jest.mock("fs", () => ({
  readFileSync: jest.fn(() => "testData"),
}));

describe("RedisClientWrapper", () => {
  const redisStub = new RedisClientStub();

  let clientWrapper: ClientWrapper;

  beforeEach(() => {
    redisStub.get.mockClear();
    redisStub.scan.mockClear();
    redisStub.select.mockClear();
    redisStub.set.mockClear();
    redisStub.evalsha.mockClear();
    clientWrapper = new ClientWrapper(redisStub as any);
  });

  describe("constructor", () => {
    it("should build a ClientWrapper instance", () => {
      const stripped = clientWrapper as any;
      expect(clientWrapper.client).toBeDefined();
      expect(stripped.cb).toBeDefined();
    });
  });

  describe("runScript", () => {
    const testPath: string = "testPath";
    const testKeys: string[] = ["testKey1", "testKey2"];
    const testVals: string[] = ["testVal1", "testVal2"];
    const testCallback = jest.fn((error: any, data: any) => {
      if (error) {
        throw new Error();
      }
    });
    const evalshaFn1WithoutError = jest.fn((arg1: any, arg2: any, arg3: any, arg4: any, cb?: any) => {
      if (cb) {
        cb(undefined, "testData");
      }
    });
    const evalshaFn1WithErrorNoScript = jest.fn((arg1: any, arg2: any, arg3: any, arg4: any, cb?: any) => {
      if (cb) {
        cb({code: "NOSCRIPT"}, "testData");
      }
    });
    const evalshaFn2WithoutError = jest.fn((arg1: any, arg2: any, arg3: any, cb?: any) => {
      if (cb) {
        cb(undefined, "testData");
      }
    });
    const evalshaFn2WithErrorNoScript = jest.fn((arg1: any, arg2: any, arg3: any, cb?: any) => {
      if (cb) {
        cb({code: "NOSCRIPT"}, "testData");
      }
    });

    beforeEach(() => {
      testCallback.mockClear();
    });

    it("should run the script - with vals", () => {
      redisStub.evalsha = evalshaFn1WithoutError;
      expect(() => clientWrapper.runScript(testPath, testKeys, testVals, testCallback)).not.toThrow();
      expect(testCallback).toHaveBeenCalled();
    });

    it("should run the script - without vals", () => {
      redisStub.evalsha = evalshaFn2WithoutError;
      expect(() => clientWrapper.runScript(testPath, testKeys, [], testCallback)).not.toThrow();
      expect(testCallback).toHaveBeenCalled();
    });

    it("should run the script - with error code NOSCRIPT", () => {
      redisStub.evalsha = evalshaFn1WithErrorNoScript;
      expect(() => clientWrapper.runScript(testPath, testKeys, testVals, testCallback)).toThrow();
      expect(testCallback).toHaveBeenCalled();
    });

    it("should not run the script - without vals and with code error NOSCRIPT", () => {
      redisStub.evalsha = evalshaFn2WithErrorNoScript;
      expect(() => clientWrapper.runScript(testPath, testKeys, [], testCallback)).toThrow();
      expect(testCallback).toHaveBeenCalled();
    });
  });
});
