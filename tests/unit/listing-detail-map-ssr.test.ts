import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LISTING_DETAIL_MAP = join(
  process.cwd(),
  "src/components/map/listing-detail-map.tsx",
);

describe("listing-detail-map SSR safety", () => {
  it("does not statically import leaflet or PropertyMap", () => {
    const source = readFileSync(LISTING_DETAIL_MAP, "utf8");
    expect(source).not.toMatch(/from\s+["']leaflet["']/);
    expect(source).not.toMatch(
      /import\s+\{[^}]*\bPropertyMap\b[^}]*\}\s+from\s+["']\.\/property-map["']/,
    );
    expect(source).toMatch(/dynamic\s*\(/);
    expect(source).toMatch(/ssr:\s*false/);
    expect(source).toMatch(/import\s*\(\s*["']\.\/property-map["']\s*\)/);
  });
});