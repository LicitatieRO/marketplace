import { describe, expect, it } from "vitest";
import {
  advanceBidConfirmStep,
  bidConfirmPrompt,
  workspaceStatusLabel,
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
  it("includes amount, minimum step and non-binding deposit/contract notice", () => {
    const ro = bidConfirmPrompt("ro", "€100.100,00", "€100,00");
    expect(ro).toContain("€100.100,00");
    expect(ro).toContain("Pas minim: €100,00");
    expect(ro).toContain("Oferta este neangajantă");
    expect(ro).toContain("nu se încheie un contract");
    const en = bidConfirmPrompt("en", "€100,100.00", "€100.00");
    expect(en).toContain("Minimum step:");
    expect(en).toContain("non-binding");
    expect(en).toContain("no contract is formed");
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
