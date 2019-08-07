import "jest";
import { Event } from "../src/subscription/Event";

describe("Event", () => {
  it("should build a filled Event", (done) => {
    const data = {
      attrs: "attrs",
      metadata: {
        deviceid: "deviceid-1",
        model: "model-1",
        payload: "payload-1",
        protocol: "protocol-1",
        topic: "topic-1",
        type: "type-1",
      },
    };
    const obj = new Event(data);

    expect(obj.attrs).toEqual("attrs");
    expect(obj.metadata.deviceid).toEqual("deviceid-1");
    expect(obj.metadata.model).toEqual("model-1");
    expect(obj.metadata.payload).toEqual("payload-1");
    expect(obj.metadata.protocol).toEqual("protocol-1");
    expect(obj.metadata.topic).toEqual("topic-1");
    expect(obj.metadata.type).toEqual("type-1");
    done();
  });
});
