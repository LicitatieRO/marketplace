import { describe, expect, it } from "vitest";
import {
  listingDocumentQualificationRow,
  listingOwnerChannelBullet,
  listingPublicMapPin,
} from "@/lib/listing-detail-facts";
import type { Listing } from "@/lib/types";

describe("listingPublicMapPin", () => {
  it("prefers public fuzzed coordinates over exact lat/lng", () => {
    const listing = {
      id: "a",
      lat: 44.464631,
      lng: 26.099441,
      publicLat: 44.468,
      publicLng: 26.102,
    } as Listing;
    expect(listingPublicMapPin(listing)).toEqual({
      lat: 44.468,
      lng: 26.102,
    });
  });

  it("returns null when no usable coordinates exist", () => {
    expect(
      listingPublicMapPin({ id: "a" } as Listing),
    ).toBeNull();
  });
});

describe("listing detail fact copy", () => {
  it("documents qualification row mentions simulation, not verification", () => {
    expect(listingDocumentQualificationRow.ro).toContain("simulare");
    expect(listingDocumentQualificationRow.en.toLowerCase()).toContain(
      "simulation",
    );
    expect(listingDocumentQualificationRow.ro).not.toMatch(/verificat/i);
  });

  it("owner channel bullet avoids verification-badge wording", () => {
    expect(listingOwnerChannelBullet.ro).not.toMatch(/verificat/i);
    expect(listingOwnerChannelBullet.ro).toContain("POC");
    expect(listingOwnerChannelBullet.en).not.toMatch(/verified/i);
  });
});