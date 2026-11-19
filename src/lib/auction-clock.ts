export interface AuctionClockPayload {
  server_now?: string;
  starts_at: string | null;
  ends_at: string | null;
}
export interface AuctionClockSample {
  serverMs: number;
  receivedMs: number;
  startsMs: number;
  endsMs: number;
}

/** Approximate display time only. PostgreSQL independently decides whether a bid is timely. */
export function sampleAuctionClock(payload: AuctionClockPayload, sentMs: number, receivedMs: number): AuctionClockSample | null {
  const serverMs = Date.parse(payload.server_now || '');
  const startsMs = Date.parse(payload.starts_at || '');
  const endsMs = Date.parse(payload.ends_at || '');
  const rtt = receivedMs - sentMs;
  if (![serverMs, startsMs, endsMs, sentMs, receivedMs].every(Number.isFinite) || rtt < 0 || rtt > 10_000 || endsMs <= startsMs) return null;
  return { serverMs: serverMs + rtt / 2, receivedMs, startsMs, endsMs };
}

export function readAuctionClock(sample: AuctionClockSample | null, monotonicMs: number) {
  const elapsed = sample ? monotonicMs - sample.receivedMs : NaN;
  if (!sample || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 30_000) {
    return { phase: 'loading' as const, stale: true, remainingSeconds: 0 };
  }
  const now = sample.serverMs + elapsed;
  const phase = now >= sample.endsMs ? 'ended' as const : now < sample.startsMs ? 'scheduled' as const : 'live' as const;
  return { phase, stale: false, remainingSeconds: Math.max(0, Math.floor((sample.endsMs - now) / 1000)) };
}
