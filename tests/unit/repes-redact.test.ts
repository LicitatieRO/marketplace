import { describe, expect, it } from "vitest";
import type { RepesAuctionEntry } from "@/lib/repes/types";
import loadSynthetic from "@/lib/repes/fixtures/synthetic-auctions.json";
import { redactRepesAuctionEntry, scrubRepesFreeText } from "@/lib/repes/redact";

const entries = (loadSynthetic as { entries: RepesAuctionEntry[] }).entries;

describe("redactRepesAuctionEntry", () => {
  it("returns allowlisted fields only", () => {
    const row = redactRepesAuctionEntry(entries[0]);
    expect(row).not.toBeNull();
    expect(Object.keys(row!)).toEqual([
      "source",
      "source_id",
      "repes_case_id",
      "repes_auction_id",
      "category",
      "property_type",
      "locality_label",
      "judet",
      "area_sqm",
      "price_minor",
      "currency",
      "guarantee_minor",
      "auction_at",
      "issuing_authority",
      "source_url",
      "withdrawn",
    ]);
    expect(row!.locality_label).toBe("Sector 3");
    expect("fileNo" in (row as object)).toBe(false);
  });

  it("drops embedded debtor, case, CF, plate, VIN and contact fragments from free text", () => {
    const blob =
      "Debitor Ion Popescu CNP 1850315123456 dosar 1234/ex/2026 CF nr 12345 B 123 ABC IF 12 XYZ VIN 1HGBH41JXMN109186 office@evil.test +40 721 000 000";
    const cleaned = scrubRepesFreeText(blob);
    expect(cleaned.toLowerCase()).not.toContain("popescu");
    expect(cleaned).not.toMatch(/1850315123456/);
    expect(cleaned).not.toMatch(/1234\/ex\/2026/i);
    expect(cleaned).not.toMatch(/cf/i);
    expect(cleaned).not.toMatch(/123\s*abc/i);
    expect(cleaned).not.toMatch(/1HGBH41JXMN109186/i);
    expect(cleaned).not.toMatch(/@evil/);
    expect(cleaned).not.toMatch(/\+40/);
  });

  it("redacts vehicle rows without retaining plate or VIN in surfaced fields", () => {
    const row = redactRepesAuctionEntry(entries[3]);
    expect(row?.category).toBe("vehicle");
    expect(JSON.stringify(row)).not.toMatch(/B\s*123\s*ABC/i);
    expect(JSON.stringify(row)).not.toMatch(/1HGBH41JXMN109186/i);
  });

  it("marks non-ACT statuses as withdrawn", () => {
    const row = redactRepesAuctionEntry(entries[2]);
    expect(row?.withdrawn).toBe(true);
  });
});
