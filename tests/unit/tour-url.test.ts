import { describe, expect, it } from "vitest";
import { safeEmbedTourUrl } from "@/lib/tour-url";

describe("safeEmbedTourUrl", () => {
  it("accepts canonical Kuula and Matterport URLs", () => {
    expect(
      safeEmbedTourUrl("https://kuula.co/share/collection/7ABcd?logo=1&info=0"),
    ).toBe("https://kuula.co/share/collection/7ABcd?logo=1&info=0");
    expect(
      safeEmbedTourUrl("https://www.kuula.co/share/AbC123"),
    ).toBe("https://www.kuula.co/share/AbC123");
    expect(
      safeEmbedTourUrl("https://my.matterport.com/show/?m=AbC123xyz&play=1"),
    ).toBe("https://my.matterport.com/show/?m=AbC123xyz&play=1");
  });

  it("rejects empty, non-HTTPS, wrong host, and missing Matterport model id", () => {
    expect(safeEmbedTourUrl(null)).toBeNull();
    expect(safeEmbedTourUrl("")).toBeNull();
    expect(safeEmbedTourUrl("http://kuula.co/share/AbC123")).toBeNull();
    expect(safeEmbedTourUrl("https://evil.example/share/AbC123")).toBeNull();
    expect(safeEmbedTourUrl("https://kuula.co.evil.example/share/AbC123")).toBeNull();
    expect(safeEmbedTourUrl("https://my.matterport.com/show/?play=1")).toBeNull();
    expect(
      safeEmbedTourUrl('<iframe src="https://kuula.co/share/AbC123"></iframe>'),
    ).toBeNull();
  });
});