import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAuctionClock, sampleAuctionClock } from '@/lib/auction-clock';

const server = '2026-11-16T06:00:00Z';
const payload = { server_now: server, starts_at: '2026-11-16T05:59:00Z', ends_at: '2026-11-16T06:02:00Z' };
afterEach(() => vi.restoreAllMocks());
describe('server-sampled auction display clock', () => {
  it('uses monotonic elapsed and RTT midpoint, ignoring a changed browser Date', () => {
    const sample = sampleAuctionClock(payload, 1000, 1200)!;
    const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(server) + 365 * 86400_000);
    expect(readAuctionClock(sample, 2200)).toMatchObject({ phase: 'live', remainingSeconds: 118, stale: false });
    spy.mockRestore();
  });
  it('treats equality as ended and a future start as scheduled', () => {
    expect(readAuctionClock(sampleAuctionClock(payload, 0, 0), 120_000).phase).toBe('loading');
    // Keep the sample fresh while testing the exact closing boundary.
    const end = sampleAuctionClock({ ...payload, server_now: payload.ends_at }, 500, 500);
    expect(readAuctionClock(end, 500).phase).toBe('ended');
    const scheduled = sampleAuctionClock({ ...payload, starts_at: '2026-11-16T06:01:00Z' }, 500, 500);
    expect(readAuctionClock(scheduled, 500).phase).toBe('scheduled');
  });
  it('fails closed for stale, reversed, missing or invalid samples', () => {
    const sample = sampleAuctionClock(payload, 100, 200);
    expect(readAuctionClock(sample, 31_201)).toMatchObject({ phase: 'loading', stale: true });
    expect(readAuctionClock(sample, 99).phase).toBe('loading');
    expect(sampleAuctionClock({ ...payload, server_now: 'invalid' }, 0, 10)).toBeNull();
    expect(sampleAuctionClock(payload, 100, 0)).toBeNull();
    expect(sampleAuctionClock(payload, 0, 10_001)).toBeNull();
    expect(readAuctionClock(null, 100).phase).toBe('loading');
  });
  it('accepts a newer extended deadline and never invents an extension locally', () => {
    const sample = sampleAuctionClock({ ...payload, ends_at: '2026-11-16T06:03:00Z' }, 0, 0);
    expect(readAuctionClock(sample, 1000).remainingSeconds).toBe(179);
    expect(sampleAuctionClock({ ...payload, ends_at: null }, 0, 0)).toBeNull();
  });
});
