import { describe, expect, it } from "vitest";
import {
  advanceBidConfirmStep,
  bidConfirmPrompt,
  bidGlossary,
  workspaceStatusLabel,
} from "@/lib/bid-copy";
import { placeBidAmountMinor } from "@/lib/bid-confirm-amount";

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
  it("includes simulated POC labelling and minimum step", () => {
    const ro = bidConfirmPrompt("ro", "€100.100,00", "€1.000,00");
    expect(ro).toContain("simulată (POC)");
    expect(ro).toContain("Pas minim:");
    expect(ro).toContain("neangajantă");
    const en = bidConfirmPrompt("en", "€100,100.00", "€1,000.00");
    expect(en).toContain("simulated (POC)");
    expect(en).toContain("non-binding");
  });
});

describe("bidGlossary simulation success copy", () => {
  it("states the bid is a simulation", () => {
    expect(bidGlossary("ro").bidRecordedSimulation).toContain("(simulare)");
    expect(bidGlossary("en").bidRecordedSimulation).toContain("(simulation)");
  });
});

describe("workspaceStatusLabel", () => {
  it("qualifies lifecycle states per Legal #55", () => {
    expect(workspaceStatusLabel("signed", "ro")).toBe(
      "Semnare simulată (ambele părți)",
    );
    expect(workspaceStatusLabel("sold", "en")).toBe("Marked sold (simulation)");
    expect(workspaceStatusLabel("reserved", "ro")).toBe("Rezervare simulată");
  });
});

describe("placeBidAmountMinor", () => {
  it("requires a confirm snapshot", () => {
    expect(placeBidAmountMinor(null, 50_000)).toBeNull();
    expect(placeBidAmountMinor(125_000)).toBe(125_000);
  });
});
