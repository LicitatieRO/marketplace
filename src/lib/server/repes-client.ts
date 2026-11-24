import "server-only";
import syntheticFixture from "@/lib/repes/fixtures/synthetic-auctions.json";
import type {
  RepesAuctionListResponse,
  RepesAuctionEntry,
} from "@/lib/repes/types";
import {
  assertRepesContactConfigured,
  buildRepesHttpUserAgent,
} from "@/lib/server/repes-contact";

export const REPES_API_BASE = "https://prod.executori.ro/repes/api";
export const REPES_FETCH_MAX_PAGES = 3;
export const REPES_FETCH_MAX_ENTRIES = 75;
export const REPES_FETCH_TIMEOUT_MS = 30_000;

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

  assertRepesContactConfigured({ useFixture: false });

  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastFetchAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastFetchAt = Date.now();

  const page = Math.max(0, options.page ?? 0);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, options.pageSize ?? 20));
  const url = `${REPES_API_BASE}/auctions?page=${page}&pageSize=${pageSize}`;
  const signal =
    options.signal ?? AbortSignal.timeout(REPES_FETCH_TIMEOUT_MS);
  let attempt = 0;
  const maxAttempts = 3;
  while (attempt < maxAttempts) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": buildRepesHttpUserAgent(),
        },
        signal,
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

export async function fetchRepesAuctionPages(options: {
  useFixture?: boolean;
  maxPages?: number;
  maxEntries?: number;
}): Promise<RepesAuctionListResponse[]> {
  const maxPages = Math.min(
    REPES_FETCH_MAX_PAGES,
    Math.max(1, options.maxPages ?? 1),
  );
  const maxEntries = Math.min(
    REPES_FETCH_MAX_ENTRIES,
    Math.max(1, options.maxEntries ?? REPES_FETCH_MAX_ENTRIES),
  );
  const pages: RepesAuctionListResponse[] = [];
  let totalEntries = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const chunk = await fetchRepesAuctionPage({
      page,
      pageSize: PAGE_SIZE_MAX,
      fixture: options.useFixture,
    });
    pages.push(chunk);
    totalEntries += chunk.entries?.length ?? 0;
    if (totalEntries >= maxEntries) break;
    if ((chunk.entries?.length ?? 0) < PAGE_SIZE_MAX) break;
  }
  return pages;
}

export function collectRepesPages(
  responses: RepesAuctionListResponse[],
  maxEntries = REPES_FETCH_MAX_ENTRIES,
): RepesAuctionEntry[] {
  const rows = responses.flatMap((page) => page.entries ?? []);
  return rows.slice(0, maxEntries);
}
