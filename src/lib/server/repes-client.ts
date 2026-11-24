import "server-only";
import syntheticFixture from "@/lib/repes/fixtures/synthetic-auctions.json";
import type {
  RepesAuctionListResponse,
  RepesAuctionEntry,
} from "@/lib/repes/types";

export const REPES_API_BASE = "https://prod.executori.ro/repes/api";
export const REPES_HTTP_USER_AGENT =
  "LicitatieRO-POC/0.1 (+https://github.com/LicitatieRO/marketplace; contact: privacy)";

export type FetchRepesOptions = {
  page?: number;
  pageSize?: number;
  fixture?: boolean;
  signal?: AbortSignal;
};

const PAGE_SIZE_MAX = 25;
const MIN_INTERVAL_MS = 2500;
let lastFetchAt = 0;

async function backoffDelay(attempt: number): Promise<void> {
  const ms = Math.min(60_000, 15_000 * 2 ** attempt);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function loadSyntheticRepesFixture(): RepesAuctionListResponse {
  return syntheticFixture as RepesAuctionListResponse;
}

export async function fetchRepesAuctionPage(
  options: FetchRepesOptions = {},
): Promise<RepesAuctionListResponse> {
  if (options.fixture || process.env.REPES_USE_FIXTURE === "true") {
    return loadSyntheticRepesFixture();
  }

  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastFetchAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastFetchAt = Date.now();

  const page = Math.max(0, options.page ?? 0);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, options.pageSize ?? 20));
  const url = `${REPES_API_BASE}/auctions?page=${page}&pageSize=${pageSize}`;
  let attempt = 0;
  const maxAttempts = 3;
  while (attempt < maxAttempts) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": REPES_HTTP_USER_AGENT,
        },
        signal: options.signal,
        next: { revalidate: 0 },
      });
      if (response.status === 429) {
        await backoffDelay(attempt);
        attempt += 1;
        continue;
      }
      if (!response.ok) {
        throw new Error(`REPES HTTP ${response.status}`);
      }
      const data = (await response.json()) as RepesAuctionListResponse;
      return {
        totalCount: data.totalCount ?? 0,
        entries: Array.isArray(data.entries) ? data.entries : [],
      };
    } catch (error) {
      if (attempt >= maxAttempts - 1) throw error;
      await backoffDelay(attempt);
      attempt += 1;
    }
  }
  return { totalCount: 0, entries: [] };
}

export function collectRepesPages(
  responses: RepesAuctionListResponse[],
): RepesAuctionEntry[] {
  return responses.flatMap((page) => page.entries ?? []);
}