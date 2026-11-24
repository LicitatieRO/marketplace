import { describe, expect, it } from "vitest";
import { scrubRepesFreeText, truncateForScrub } from "@/lib/repes/scrub-text";

describe("scrubRepesFreeText", () => {
  it("removes CF numbers and dosar executare references", () => {
    const cleaned = scrubRepesFreeText(
      "CF nr 12345 Carte Funciară nr. 9988 dosar (de) executare nr. 88/ex/2025",
    );
    expect(cleaned).not.toMatch(/12345/);
    expect(cleaned).not.toMatch(/9988/);
    expect(cleaned).not.toMatch(/88\/ex\/2025/);
  });

  it("removes street addresses and owner context names", () => {
    const cleaned = scrubRepesFreeText(
      "Proprietar Ionescu Maria str. Exemplu nr. 12 bd. Magheru 24",
    );
    expect(cleaned.toLowerCase()).not.toContain("ionescu");
    expect(cleaned).not.toMatch(/nr\.?\s*12/);
  });

  it("handles long pathological input without hanging", () => {
    const pathological = `${"A".repeat(10_000)} B 123 ABC ${"9".repeat(400)}`;
    const bounded = truncateForScrub(pathological);
    expect(bounded.length).toBeLessThanOrEqual(500);
    const cleaned = scrubRepesFreeText(pathological);
    expect(cleaned).not.toMatch(/123\s*abc/i);
    expect(cleaned.length).toBeLessThanOrEqual(500);
  });
});
