import { describe, expect, it, vi } from "vitest";
import { sanitizeDemoListingForClient } from "@/lib/server/demo-listing-client";
import type { Listing } from "@/lib/types";

vi.mock("server-only", () => ({}));

describe("sanitizeDemoListingForClient", () => {
  it("drops map pin when public coordinates are missing", () => {
    const listing = {
      id: "x",
      title: "Test",
      lat: 44.464631,
      lng: 26.099441,
    } as Listing;
    const sanitized = sanitizeDemoListingForClient(listing);
    expect(sanitized).not.toHaveProperty("lat");
    expect(sanitized).not.toHaveProperty("lng");
    expect(sanitized).not.toHaveProperty("publicLat");
    expect(sanitized).not.toHaveProperty("publicLng");
  });
});

describe("demo catalogue client coordinates", () => {
  it("does not expose exact lat/lng in demo fallback payloads", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const { getCatalogue } = await import("@/lib/server/catalogue");
    const rows = await getCatalogue();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).not.toHaveProperty("lat");
      expect(row).not.toHaveProperty("lng");
      expect(row.publicLat).toBeDefined();
      expect(row.publicLng).toBeDefined();
      expect(String(row.publicLat)).not.toMatch(/\.{4,}\d/);
    }
    const exact = 44.46463;
    expect(rows.some((row) => row.publicLat === exact)).toBe(false);
  });
});
