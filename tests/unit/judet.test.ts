import { describe, expect, it } from "vitest";
import { isValidJudet, resolveJudet } from "@/lib/judet";

describe("judet validator", () => {
  it("accepts canonical counties", () => {
    expect(resolveJudet("Cluj")).toBe("Cluj");
    expect(resolveJudet("bucuresti")).toBe("București");
    expect(resolveJudet("Bistrita-Nasaud")).toBe("Bistrița-Năsăud");
  });

  it("rejects non-Romanian judete", () => {
    expect(isValidJudet("Chisinau")).toBe(false);
  });
});