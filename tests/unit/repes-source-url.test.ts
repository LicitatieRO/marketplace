import { describe, expect, it } from "vitest";
import {
  assertAllowedRepesSourceUrl,
  isAllowedRepesSourceUrl,
} from "@/lib/repes/source-url";

describe("REPES source URL guard", () => {
  it("accepts executori.ro hosts over https", () => {
    expect(
      isAllowedRepesSourceUrl(
        "https://prod.executori.ro/repes/#/auction/X/Y",
      ),
    ).toBe(true);
  });

  it("rejects other hosts and non-https schemes", () => {
    expect(isAllowedRepesSourceUrl("https://evil.example/auction")).toBe(false);
    expect(isAllowedRepesSourceUrl("http://prod.executori.ro/repes/")).toBe(
      false,
    );
  });

  it("assertAllowed throws for invalid hosts", () => {
    expect(() => assertAllowedRepesSourceUrl("https://bidu.ro/x")).toThrow();
  });
});
