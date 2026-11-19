import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROMANIA_BBOX } from "@/lib/geo-bounds";

const MIGRATION = path.join(
  process.cwd(),
  "supabase/migrations/202611140017_property_geo_romania.sql",
);

function migrationBounds() {
  const sql = readFileSync(MIGRATION, "utf8");
  const lat = sql.match(
    /lat IS NULL OR lat BETWEEN ([\d.]+) AND ([\d.]+)/,
  );
  const lng = sql.match(
    /lng IS NULL OR lng BETWEEN ([\d.]+) AND ([\d.]+)/,
  );
  if (!lat || !lng) {
    throw new Error("Could not parse ROMANIA bounds from migration");
  }
  return {
    minLat: Number(lat[1]),
    maxLat: Number(lat[2]),
    minLng: Number(lng[1]),
    maxLng: Number(lng[2]),
  };
}

describe("ROMANIA_BBOX ↔ migration CHECK parity", () => {
  it("matches supabase/migrations/202611140017_property_geo_romania.sql", () => {
    const fromSql = migrationBounds();
    expect(ROMANIA_BBOX.minLat).toBe(fromSql.minLat);
    expect(ROMANIA_BBOX.maxLat).toBe(fromSql.maxLat);
    expect(ROMANIA_BBOX.minLng).toBe(fromSql.minLng);
    expect(ROMANIA_BBOX.maxLng).toBe(fromSql.maxLng);
  });
});