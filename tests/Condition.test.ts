import "jest";
import { Condition } from "../src/subscription/Condition";

describe("Condition", () => {
  it("should build an empty Condition", (done) => {
    const obj = new Condition();
    expect(obj.attrs).toEqual([]);
    expect(obj.expression.coords).toEqual(null);
    expect(obj.expression.geometry).toEqual(null);
    expect(obj.expression.georel).toEqual(null);
    expect(obj.expression.mq).toEqual(null);
    expect(obj.expression.q).toEqual(null);
    done();
  });
});
