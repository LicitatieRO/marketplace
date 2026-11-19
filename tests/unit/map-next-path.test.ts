import { describe, expect, it } from "vitest";
import { isAllowedMapNextPath } from "@/lib/map-next-path";
import { safeReturnPath } from "@/lib/security";

describe("map next-path validator", () => {
  it("allows map listing deep links", () => {
    expect(
      isAllowedMapNextPath("/map?listing=20000000-0000-4000-8000-000000000001"),
    ).toBe(true);
    expect(
      safeReturnPath(
        "/map?listing=20000000-0000-4000-8000-000000000001&intent=bid",
      ),
    ).toBe("/map?listing=20000000-0000-4000-8000-000000000001&intent=bid");
  });

  it("rejects external redirect patterns", () => {
    expect(safeReturnPath("//evil.example")).toBe("/workspace");
  });
});