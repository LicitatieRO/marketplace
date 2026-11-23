import { describe, expect, it } from "vitest";
import { waitForSelector } from "@/lib/tour/wait-for-selector";

describe("waitForSelector", () => {
  it("returns missing when document is unavailable", async () => {
    const result = await waitForSelector('[data-tour="missing"]', 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing");
  });
});