"use client";
import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { Listing } from '@/lib/types';
import { readAuctionClock, sampleAuctionClock, type AuctionClockSample } from '@/lib/auction-clock';
import { dateTime } from '@/lib/format';
import { usePlatform } from './platform';

type Timing = { listingId: string; auctionId: string | null; sample: AuctionClockSample; listing: Listing };

export function useAuctionCountdown(listing: Listing) {
  const [timing, setTiming] = useState<Timing | null>(null);
  const [monotonicMs, setMonotonicMs] = useState(0);
  useEffect(() => {
    if (!listing.auction_id) return;
    let disposed = false;
    let syncing = false;
    let request: AbortController | undefined;
    async function sync() {
      if (disposed || syncing || document.visibilityState === 'hidden') return;
      syncing = true;
      request = new AbortController();
      const timeout = setTimeout(() => request?.abort(), 8000);
      const sentMs = performance.now();
      try {
        const response = await fetch(`/api/listings/${listing.id}`, { cache: 'no-store', credentials: 'same-origin', signal: request.signal });
        if (!response.ok) throw new Error('Clock unavailable');
        const body = await response.json();
        const receivedMs = performance.now();
        const data = body.data as Listing | null;
        if (!data || data.id !== listing.id || data.auction_id !== listing.auction_id) throw new Error('Auction changed');
        const sample = sampleAuctionClock(data, sentMs, receivedMs);
        if (!sample) throw new Error('Clock unavailable');
        if (!disposed) {
          setTiming({ listingId: data.id, auctionId: data.auction_id, sample, listing: data });
          setMonotonicMs(receivedMs);
        }
      } catch {
        if (!disposed) setTiming(null);
      } finally {
        clearTimeout(timeout);
        syncing = false;
      }
    }
    void sync();
    const refresh = setInterval(() => void sync(), 15_000);
    const tick = setInterval(() => setMonotonicMs(performance.now()), 1000);
    const visible = () => { if (document.visibilityState === 'visible') void sync(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      request?.abort();
      clearInterval(refresh);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [listing.id, listing.auction_id, listing.ends_at]);
  const current = timing?.listingId === listing.id && timing.auctionId === listing.auction_id ? timing : null;
  return {
    ...readAuctionClock(current?.sample || null, monotonicMs),
    endsAt: current?.listing.ends_at || listing.ends_at,
    startsAt: current?.listing.starts_at || listing.starts_at,
    softCloseSeconds: current?.listing.soft_close_seconds ?? listing.soft_close_seconds ?? 0,
    maxEndsAt: current?.listing.max_ends_at || listing.max_ends_at || null,
  };
}

export type AuctionCountdownState = ReturnType<typeof useAuctionCountdown>;
export function AuctionCountdown({ clock }: { clock: AuctionCountdownState }) {
  const { language, t } = usePlatform();
  const seconds = clock.remainingSeconds;
  const label = clock.phase === 'loading' ? t('Stare', 'Status') : clock.phase === 'ended' ? t('Închisă', 'Closed') : clock.phase === 'scheduled' ? t('Începe la', 'Starts at') : t('Timp rămas', 'Time remaining');
  const display = clock.phase === 'loading' ? t('Se încarcă…', 'Loading…') : clock.phase === 'scheduled' && clock.startsAt ? dateTime(clock.startsAt, language) : clock.phase === 'ended' && clock.endsAt ? dateTime(clock.endsAt, language) : `${Math.floor(seconds / 86400)}${t('z', 'd')} ${Math.floor(seconds % 86400 / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
  return <div className="countdown" data-testid="auction-countdown" data-phase={clock.phase} data-ends-at={clock.endsAt}>
    <Clock3 size={16} aria-hidden="true" />
    <div><span>{label}</span><strong>{display}</strong></div>
  </div>;
}
