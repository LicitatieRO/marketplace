"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  parseCatalogueMapFilters,
  type CatalogueMapFilterParams,
} from "@/lib/catalogue-map-path";
import {
  defaultCatalogueNeighborhoodAllowlist,
  sanitizeCatalogueMapFilters,
} from "@/lib/catalogue-map-filter-sanitize";
import { applyCatalogueFiltersToMapListings } from "@/lib/map-listing-catalogue-filters";
import {
  buildMapListingFilterMeta,
  catalogueNeighborhoodsFromListings,
  type MapListingFilterMeta,
} from "@/lib/map-listing-filter-meta";
import type { Listing } from "@/lib/types";
import {
  normalizeMapBbox,
  type MapBbox as QueryMapBbox,
} from "@/lib/map-bounds-query";
import type { MapListing } from "@/lib/map-listing-types";
import {
  bidGlossary,
  legalMapPageTitle,
  legalMapScheduledAuctionFallback,
} from "@/lib/bid-copy";
import { BidConfirmPanel } from "@/components/bid-confirm-panel";
import { formatEurCompact } from "@/lib/format-eur-compact";
import { dateTime, money } from "@/lib/format";
import { ROMANIA_BBOX } from "@/lib/geo-bounds";
import {
  listingsMapSearchParams,
  parseListingsMapListingId,
  parseListingsMapView,
} from "@/lib/listings-map-url";
import {
  effectiveServerNowMs,
  formatMapEndedCardLine,
  formatMapTimeLeftLabel,
} from "@/lib/map-listing-time";
import {
  OPTIONAL_CONTENT_STORAGE_KEY,
  type OptionalContentChoice,
} from "@/lib/optional-content";
import { notifyOptionalContentChanged } from "@/lib/optional-content-events";
import { useAllowsOptionalContent } from "@/components/disclosures/cookie-consent-banner";
import { Feedback, useMutation, usePlatform } from "@/components/platform";
import { ListingsMapCanvas } from "./listings-map-canvas";

type MapBbox = { west: number; south: number; east: number; north: number };

const DEFAULT_BBOX: MapBbox = {
  west: ROMANIA_BBOX.minLng,
  south: ROMANIA_BBOX.minLat,
  east: ROMANIA_BBOX.maxLng,
  north: ROMANIA_BBOX.maxLat,
};

function listingPath(slug: string) {
  return `/listings/${slug}`;
}

function focusableCardNodes(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => !node.hasAttribute("disabled") && node.tabIndex !== -1);
}

export function ListingsMapPage() {
  const { t, language, viewer, configured } = usePlatform();
  const bidTerms = bidGlossary(language);
  const globalAllows = useAllowsOptionalContent();
  const [localAccepted, setLocalAccepted] = useState(false);
  const allowsTiles = globalAllows || localAccepted;
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [listings, setListings] = useState<MapListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [searchOnMove, setSearchOnMove] = useState(true);
  const [bbox, setBbox] = useState<MapBbox>(DEFAULT_BBOX);
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null);
  const [bidMinor, setBidMinor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  const [clientNowMs, setClientNowMs] = useState(0);
  const [rawUrlFilters, setRawUrlFilters] =
    useState<CatalogueMapFilterParams>({});
  const [neighborhoodAllowlist, setNeighborhoodAllowlist] = useState(() =>
    defaultCatalogueNeighborhoodAllowlist(),
  );
  const [filterMeta, setFilterMeta] = useState<
    Map<string, MapListingFilterMeta>
  >(new Map());
  const catalogueFilters = useMemo(
    () => sanitizeCatalogueMapFilters(rawUrlFilters, neighborhoodAllowlist),
    [rawUrlFilters, neighborhoodAllowlist],
  );
  const mutation = useMutation();
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const cardPanelRef = useRef<HTMLDivElement>(null);
  const confirmPrimaryRef = useRef<HTMLButtonElement>(null);
  const lastSelectedIdRef = useRef<string | null>(null);
  const listingsRef = useRef(listings);
  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const lastFetchedBboxRef = useRef("");
  const panFetchCountRef = useRef(0);
  const panFetchResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAP_PAN_FETCH_LIMIT = 3;

  const visibleListings = useMemo(
    () =>
      applyCatalogueFiltersToMapListings(
        listings,
        catalogueFilters,
        filterMeta,
      ),
    [listings, catalogueFilters, filterMeta],
  );

  const selected = visibleListings.find((l) => l.id === selectedId) ?? null;
  const serverNowMs = effectiveServerNowMs(clientNowMs, serverClockOffsetMs);

  const syncMapUrl = useCallback(() => {
    const params = listingsMapSearchParams({
      listingId: selectedId,
      bbox,
      mobileView,
      existing: new URLSearchParams(window.location.search),
    });
    const next = `/map?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [bbox, mobileView, selectedId]);

  const returnFocusToListing = useCallback((listingId: string | null) => {
    if (!listingId) return;
    const listCard = document.querySelector<HTMLElement>(
      `[data-testid="map-list-card-${listingId}"]`,
    );
    const mapPill = document.querySelector<HTMLElement>(
      `[data-listing-id="${listingId}"]`,
    );
    (listCard ?? mapPill)?.focus();
  }, []);

  const closeMapCard = useCallback(() => {
    const previous = lastSelectedIdRef.current ?? selectedId;
    setSelectedId(null);
    setConfirmAmount(null);
    setBidMinor(null);
    requestAnimationFrame(() => returnFocusToListing(previous));
  }, [returnFocusToListing, selectedId]);

  const fetchListings = useCallback(async (nextBbox: MapBbox) => {
    const normalized = normalizeMapBbox(nextBbox as QueryMapBbox);
    const key = `${normalized.west},${normalized.south},${normalized.east},${normalized.north}`;
    if (key === lastFetchedBboxRef.current) return;
    lastFetchedBboxRef.current = key;

    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setLoading(true);
    setFetchError(null);
    const clientAtFetch = Date.now();
    try {
      const qs = new URLSearchParams({
        west: String(normalized.west),
        south: String(normalized.south),
        east: String(normalized.east),
        north: String(normalized.north),
      });
      const response = await fetch(`/api/map/listings?${qs.toString()}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setFetchError(
          t(
            "Nu am putut încărca anunțurile pe hartă.",
            "Could not load listings for the map.",
          ),
        );
        return;
      }
      const json = (await response.json()) as {
        data?: MapListing[];
        serverNowMs?: number;
      };
      if (typeof json.serverNowMs === "number") {
        setServerClockOffsetMs(json.serverNowMs - clientAtFetch);
        setClientNowMs(clientAtFetch);
      }
      setListings(json.data ?? []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFetchError(
        t(
          "Nu am putut încărca anunțurile pe hartă.",
          "Could not load listings for the map.",
        ),
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(
    () => () => {
      fetchAbortRef.current?.abort();
    },
    [],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- mount-only URL hydration */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const listing = parseListingsMapListingId(params.get("listing"));
    if (listing) setSelectedId(listing);
    setMobileView(parseListingsMapView(params));
    setClientNowMs(Date.now());
    setRawUrlFilters(parseCatalogueMapFilters(params));
    void fetchListings(DEFAULT_BBOX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/catalogue", { cache: "no-store" });
        if (!response.ok || !active) return;
        const body = (await response.json()) as { data?: Listing[] };
        const catalogue = body.data ?? [];
        if (!active || catalogue.length === 0) return;
        setFilterMeta(buildMapListingFilterMeta(catalogue));
        setNeighborhoodAllowlist(catalogueNeighborhoodsFromListings(catalogue));
      } catch {
        /* keep demo allowlist */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    syncMapUrl();
    if (selectedId) {
      lastSelectedIdRef.current = selectedId;
      cardTitleRef.current?.focus();
    }
  }, [selectedId, bbox, mobileView, syncMapUrl]);

  useEffect(() => {
    if (clientNowMs <= 0) return;
    const tick = () => setClientNowMs(Date.now());
    const urgent =
      selected?.status === "live" &&
      selected.endsAt &&
      new Date(selected.endsAt).getTime() - serverNowMs < 3_600_000;
    const interval = window.setInterval(tick, urgent ? 1_000 : 30_000);
    return () => window.clearInterval(interval);
  }, [clientNowMs, selected?.endsAt, selected?.status, serverNowMs]);

  useEffect(() => {
    if (confirmAmount !== null) {
      confirmPrimaryRef.current?.focus();
      return;
    }
    if (selectedId) {
      cardTitleRef.current?.focus();
    }
  }, [confirmAmount, selectedId]);

  useEffect(() => {
    if (!selectedId || confirmAmount !== null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMapCard();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMapCard, confirmAmount, selectedId]);

  useEffect(() => {
    if (confirmAmount === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setConfirmAmount(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmAmount]);

  useEffect(() => {
    const panel = cardPanelRef.current;
    if (!panel || mobileView !== "map" || !selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = focusableCardNodes(panel);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, [mobileView, selectedId]);

  const acceptMap = () => {
    setLocalAccepted(true);
    if (!globalAllows) {
      const choice: OptionalContentChoice = "accepted";
      localStorage.setItem(OPTIONAL_CONTENT_STORAGE_KEY, choice);
      notifyOptionalContentChanged();
    }
  };

  const onBoundsChange = useCallback(
    (next: MapBbox) => {
      setBbox(next);
      if (!searchOnMove) return;
      panFetchCountRef.current += 1;
      if (panFetchCountRef.current > MAP_PAN_FETCH_LIMIT) return;
      if (panFetchResetRef.current) clearTimeout(panFetchResetRef.current);
      panFetchResetRef.current = setTimeout(() => {
        panFetchCountRef.current = 0;
        panFetchResetRef.current = null;
      }, 800);
      void fetchListings(next);
    },
    [fetchListings, searchOnMove],
  );

  const minimumBid = selected
    ? selected.currentBidCents + selected.minIncrementCents
    : 0;

  const selectListing = useCallback((id: string) => {
    setSelectedId(id);
    const item = listingsRef.current.find((entry) => entry.id === id);
    if (item) {
      setBidMinor(item.currentBidCents + item.minIncrementCents);
    }
    setConfirmAmount(null);
  }, []);

  const submitBid = async () => {
    if (!selected || bidMinor === null || confirmAmount === null) return;
    if (!selected.auctionId) return;
    const ok = await mutation.mutate(
      "place_bid",
      {
        p_auction_id: selected.auctionId,
        p_amount_minor: bidMinor,
      },
      bidTerms.bidRecordedSimulation,
    );
    setConfirmAmount(null);
    if (ok) void fetchListings(bbox);
  };

  const selectedTimeLeft = selected
    ? formatMapTimeLeftLabel(
        selected.status,
        selected.startsAt,
        selected.endsAt,
        serverNowMs,
        language,
      )
    : null;

  const card = selected ? (
    <div
      ref={cardPanelRef}
      className="lr-map-card panel"
      role="dialog"
      aria-modal={mobileView === "map" ? true : undefined}
      aria-labelledby="lr-map-card-title"
      data-testid="listings-map-card"
    >
      {selected.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={selected.photoUrl}
          alt={selected.title}
          className="lr-map-card-photo"
          loading="lazy"
        />
      ) : null}
      <p className="chip">{selected.status === "live" ? t("Live", "Live") : selected.status === "scheduled" ? t("Programat", "Scheduled") : t("Încheiat", "Ended")}</p>
      <h2 id="lr-map-card-title" ref={cardTitleRef} tabIndex={-1} className="lr-map-card-title">
        {selected.title}
      </h2>
      <p className="muted">
        {selected.sector} · {selected.neighbourhood}{" "}
        <span className="small">
          ({t("zonă aproximativă", "approximate area")})
        </span>
      </p>
      <div className="lr-map-card-bid">
        <strong>{money(selected.currentBidCents, language)}</strong>
        <span className="chip poc">POC / Simulare</span>
      </div>
      <p className="muted small">
        {t("Pas minim:", "Min. increment:")} +
        {money(selected.minIncrementCents, language)}
      </p>
      {selectedTimeLeft ? (
        <p
          className={`lr-map-card-time small${selectedTimeLeft.urgent ? " is-urgent" : ""}`}
          data-testid="map-card-time-left"
        >
          {selectedTimeLeft.text}
        </p>
      ) : null}
      {selected.status === "ended" ? (
        <p className="muted" data-testid="map-card-ended-copy">
          {formatMapEndedCardLine(selected.currentBidCents, language)}
        </p>
      ) : null}
      {!viewer ? (
        selected.status === "live" ? (
          <Link
            className="button primary"
            data-testid="map-guest-bid-login"
            href={`/login?next=${encodeURIComponent(`/map?listing=${selected.id}&intent=bid`)}`}
          >
            {bidTerms.signInToBid}
          </Link>
        ) : null
      ) : selected.isOwn ? (
        <p className="feedback notice" data-testid="map-own-no-bid">
          {t(
            "Aceasta este proprietatea ta, nu poți licita.",
            "This is your listing; you can't bid.",
          )}{" "}
          <Link href="/workspace">{t("Gestionează", "Manage")}</Link>
        </p>
      ) : selected.status === "scheduled" ? (
        <p className="muted" data-testid="map-card-scheduled-copy">
          {selected.startsAt
            ? t(
                `Începe pe ${dateTime(selected.startsAt, "ro")}`,
                `Starts ${dateTime(selected.startsAt, "en")}`,
              )
            : legalMapScheduledAuctionFallback(language)}
        </p>
      ) : selected.status === "live" && configured ? (
        <div className="lr-map-bid-control">
          {selected.outbid ? (
            <p className="feedback warn" aria-live="polite">
              {t(
                `Ai fost depășit. Oferta curentă: ${money(selected.currentBidCents, language)}`,
                `You've been outbid. Current bid: ${money(selected.currentBidCents, language)}`,
              )}
            </p>
          ) : null}
          {selected.leadingBid ? (
            <p className="feedback success" aria-live="polite">
              {t("Ești pe primul loc", "You're the highest bidder")}
            </p>
          ) : null}
          <label className="small" htmlFor="map-bid-amount">
            {bidTerms.bidAmountLabel}
          </label>
          <input
            id="map-bid-amount"
            data-testid="map-bid-amount"
            type="number"
            min={minimumBid / 100}
            step={selected.minIncrementCents / 100}
            value={bidMinor !== null ? bidMinor / 100 : ""}
            onChange={(e) =>
              setBidMinor(Math.round(Number(e.target.value) * 100))
            }
          />
          <button
            type="button"
            className="button primary"
            data-testid="map-place-bid"
            disabled={bidMinor === null || bidMinor < minimumBid}
            onClick={() => setConfirmAmount(bidMinor)}
          >
            {bidTerms.placeBid}
          </button>
        </div>
      ) : null}
      {selected.status === "scheduled" && viewer ? (
        <Link href={listingPath(selected.slug)} className="button">
          {t("Urmărește", "Watch")}
        </Link>
      ) : null}
      {confirmAmount !== null ? (
        <BidConfirmPanel
          language={language}
          amountMinor={confirmAmount}
          minIncrementMinor={selected.minIncrementCents}
          busy={mutation.busy}
          testId="map-bid-confirm-panel"
          confirmButtonRef={confirmPrimaryRef}
          onCancel={() => setConfirmAmount(null)}
          onConfirm={() => void submitBid()}
        />
      ) : null}
      <Link href={listingPath(selected.slug)} className="button">
        {t("Vezi proprietatea →", "View property →")}
      </Link>
    </div>
  ) : null;

  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const mapSurface = (
    <ListingsMapCanvas
      allowsTiles={allowsTiles}
      showOnLayout={desktop || mobileView === "map"}
      listings={visibleListings}
      selectedId={selectedId}
      highlightedId={highlightedId}
      serverClockOffsetMs={serverClockOffsetMs}
      onSelect={selectListing}
      onBoundsChange={onBoundsChange}
      onAcceptMap={acceptMap}
    />
  );

  return (
    <div className="listings-map-page page-width" data-testid="listings-map-page">
      <a href="#map-list-panel" className="skip-link">
        {t("Sari la listă", "Skip to list")}
      </a>
      <header className="listings-map-toolbar">
        <h1>{legalMapPageTitle(language)}</h1>
        <label className="small">
          <input
            type="checkbox"
            checked={searchOnMove}
            onChange={(e) => setSearchOnMove(e.target.checked)}
          />{" "}
          {t("Caută când muți harta", "Search as I move the map")}
        </label>
        {!searchOnMove ? (
          <button
            type="button"
            className="button"
            onClick={() => void fetchListings(bbox)}
          >
            {t("Caută în această zonă", "Search this area")}
          </button>
        ) : null}
        {loading ? <span aria-live="polite">{t("Se încarcă…", "Loading…")}</span> : null}
        {fetchError ? (
          <p className="feedback error" role="alert" data-testid="listings-map-fetch-error">
            {fetchError}
          </p>
        ) : null}
      </header>
      <div className="listings-map-layout">
        <aside id="map-list-panel" className="listings-map-list" aria-label={t("Listă proprietăți", "Property list")}>
          {visibleListings.length === 0 ? (
            <p>
              {t(
                "Nicio proprietate în această zonă. Micșorează harta sau resetează filtrele.",
                "No properties in this area. Zoom out or reset filters.",
              )}
            </p>
          ) : (
            visibleListings.map((item) => {
              const rowTime = formatMapTimeLeftLabel(
                item.status,
                item.startsAt,
                item.endsAt,
                serverNowMs,
                language,
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`listings-map-list-card${item.id === selectedId ? " is-selected" : ""}`}
                  data-testid={`map-list-card-${item.id}`}
                  onMouseEnter={() => setHighlightedId(item.id)}
                  onMouseLeave={() => setHighlightedId(null)}
                  onClick={() => selectListing(item.id)}
                >
                  <span className="listings-map-list-card-row">
                    {item.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photoUrl}
                        alt=""
                        className="listings-map-list-card-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="listings-map-list-card-thumb is-placeholder"
                        aria-hidden="true"
                      />
                    )}
                    <span className="listings-map-list-card-body">
                      <strong>{item.title}</strong>
                      <span className="muted small">
                        {formatEurCompact(item.currentBidCents, language)} ·{" "}
                        {item.neighbourhood}
                      </span>
                      {rowTime ? (
                        <span
                          className={`small listings-map-list-card-time${rowTime.urgent ? " is-urgent" : ""}`}
                          data-testid={`map-list-row-time-${item.id}`}
                        >
                          {rowTime.text}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </aside>
        <section className="listings-map-map">
          <button
            type="button"
            className="listings-map-mobile-toggle"
            data-testid="listings-map-mobile-toggle"
            onClick={() =>
              setMobileView((v) => (v === "list" ? "map" : "list"))
            }
          >
            {mobileView === "list"
              ? t(`Hartă · ${visibleListings.length}`, `Map · ${visibleListings.length}`)
              : t("Listă", "List")}
          </button>
          {mapSurface}
          {selected ? card : null}
        </section>
      </div>
      <Feedback error={mutation.error} message={mutation.message} />
    </div>
  );
}
