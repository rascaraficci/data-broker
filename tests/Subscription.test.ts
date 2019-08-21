import "jest";
import { Subscription } from "../src/subscription/Subscription";

// tslint:disable:no-unused-expression

describe("Subscription", () => {
  it("should build an empty Subscription", (done) => {
    const obj = new Subscription();
    expect(obj.id).toEqual("");
    expect(obj.subject.entities.id).toEqual("");
    expect(obj.subject.entities.idPattern).toEqual("");
    expect(obj.subject.entities.model).toEqual("");
    expect(obj.subject.entities.modelPattern).toEqual("");
    expect(obj.subject.entities.type).toEqual("");
    expect(obj.subject.entities.typePattern).toEqual("");
    expect(obj.subject.condition).toEqual(null);
    expect(obj.notification.topic).toEqual("");
    expect(obj.notification.attrs).toEqual([]);
    done();
  });
});
