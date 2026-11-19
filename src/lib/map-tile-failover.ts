/** Counts raster tile load errors within a sliding window for OSM → PMTiles failover. */
export class MapTileFailoverCounter {
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  recordTileLoadError(): { shouldFailover: boolean; count: number } {
    const t = this.now();
    this.timestamps.push(t);
    this.prune(t);
    const count = this.timestamps.length;
    return { shouldFailover: count >= this.limit, count };
  }

  reset(): void {
    this.timestamps = [];
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((ts) => ts >= cutoff);
  }
}