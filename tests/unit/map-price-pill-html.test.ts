import { describe, expect, it } from "vitest";
import { mapPricePillButtonHtml } from "@/lib/map-price-pill-html";

const UUID = "20000000-0000-4000-8000-000000000001";

describe("mapPricePillButtonHtml", () => {
  it("escapes XSS payloads in aria-label and price text", () => {
    const malicious = `'"><img src=x onerror=alert(1)>'`;
    const html = mapPricePillButtonHtml(
      `<script>${malicious}</script>`,
      UUID,
      `Floreasca, €125k, ${malicious}`,
      { own: true, outbid: true },
    );
    expect(html).not.toMatch(/[^&]<(script|img)\b/i);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain("&quot;");
    expect(html).toContain("&lt;");
    expect(html).toContain("lr-own-dot");
    expect(html).toContain("lr-outbid-dot");
  });

  it("rejects unsafe listing ids", () => {
    const html = mapPricePillButtonHtml(
      "€100k",
      `"><img src=x onerror=alert(1)>`,
      "label",
    );
    expect(html).toContain('data-listing-id=""');
    expect(html).not.toContain("<img");
  });
});
