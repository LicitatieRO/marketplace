import { describe, expect, it } from "vitest";
import { parseTourQueryParam } from "@/lib/tour/parse-tour-query";

describe("parseTourQueryParam", () => {
  it("maps buyer aliases and owner", () => {
    expect(parseTourQueryParam("1").kind).toBe("start");
    expect(parseTourQueryParam("buyer")).toEqual({ kind: "start", tour: "buyer" });
    expect(parseTourQueryParam("owner")).toEqual({ kind: "start", tour: "owner" });
  });

  it("forces tour off", () => {
    expect(parseTourQueryParam("0")).toEqual({ kind: "off" });
    expect(parseTourQueryParam("off")).toEqual({ kind: "off" });
  });

  it("ignores unknown values", () => {
    expect(parseTourQueryParam("nope")).toEqual({ kind: "noop" });
    expect(parseTourQueryParam(null)).toEqual({ kind: "noop" });
  });
});