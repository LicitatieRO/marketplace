export type AuctionClockPhase = "loading" | "ended" | "scheduled" | "live";

export function auctionClockPhase(
  nowMs: number,
  startsAt: string | null,
  endsAt: string | null,
): AuctionClockPhase {
  if (nowMs <= 0) return "loading";
  if (endsAt && nowMs > new Date(endsAt).getTime()) return "ended";
  if (startsAt && nowMs < new Date(startsAt).getTime()) return "scheduled";
  return "live";
}