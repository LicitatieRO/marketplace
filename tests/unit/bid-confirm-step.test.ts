import { describe, expect, it } from "vitest";
import {
  advanceBidConfirmStep,
  bidConfirmPrompt,
} from "@/lib/bid-copy";

describe("advanceBidConfirmStep", () => {
  it("opens confirm from edit", () => {
    expect(advanceBidConfirmStep("edit", "open_confirm")).toBe("confirm");
  });

  it("returns to edit on cancel or after submit", () => {
    expect(advanceBidConfirmStep("confirm", "cancel")).toBe("edit");
    expect(advanceBidConfirmStep("confirm", "submit")).toBe("edit");
  });
});

describe("bidConfirmPrompt", () => {
  it("includes amount, minimum step and simulation notice", () => {
    const ro = bidConfirmPrompt("ro", "€100.100,00", "€100,00");
    expect(ro).toContain("€100.100,00");
    expect(ro).toContain("Pas minim: €100,00");
    expect(ro).toContain("simulare (POC)");
    const en = bidConfirmPrompt("en", "€100,100.00", "€100.00");
    expect(en).toContain("Minimum step:");
    expect(en).toContain("simulation (POC)");
  });
});
