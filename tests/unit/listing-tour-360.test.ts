import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ListingTour360 } from "@/components/listing-tour-360";

vi.mock("@/components/disclosures/cookie-consent-banner", () => ({
  useAllowsOptionalContent: () => false,
}));

vi.mock("@/components/platform", () => ({
  usePlatform: () => ({
    t: (ro: string, _en: string) => ro,
  }),
}));

describe("ListingTour360", () => {
  it("shows the not-provided copy when tour URL is missing", () => {
    const html = renderToStaticMarkup(
      createElement(ListingTour360, { tourUrl: null }),
    );
    expect(html).toContain("Tur virtual: nu a fost furnizat de proprietar.");
    expect(html).not.toContain("virtual-tour");
  });

  it("shows the open control when tour URL is allowlisted", () => {
    const html = renderToStaticMarkup(
      createElement(ListingTour360, {
        tourUrl: "https://kuula.co/share/collection/demo?logo=1",
      }),
    );
    expect(html).toContain('class="virtual-tour"');
    expect(html).toContain("Deschide turul 360°");
    expect(html).not.toContain("nu a fost furnizat");
  });
});