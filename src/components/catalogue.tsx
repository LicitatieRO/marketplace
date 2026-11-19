"use client";
/* eslint-disable @next/next/no-img-element */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  ChevronDown,
  Heart,
  Home,
  MapPin,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import type { Listing, TransactionType } from "@/lib/types";
import { listingTitle } from "@/lib/i18n";
import { money } from "@/lib/format";
import { buildMapPathFromCatalogueFilters } from "@/lib/catalogue-map-path";
import { Feedback, useMutation, usePlatform } from "./platform";

const CatalogueMap = dynamic(
  () =>
    import("@/components/map/catalogue-map").then((m) => ({
      default: m.CatalogueMap,
    })),
  { ssr: false },
);

export function Catalogue({ listings }: { listings: Listing[] }) {
  const { t, language, setCatalogueMapPath } = usePlatform();
  const [transaction, setTransaction] = useState<TransactionType>("sale");
  const [query, setQuery] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rooms, setRooms] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [sort, setSort] = useState("recommended");
  const [advanced, setAdvanced] = useState(false);
  const neighborhoods = Array.from(
    new Set(listings.map((item) => item.neighborhood)),
  ).sort();
  const filtered = useMemo(
    () =>
      listings
        .filter(
          (item) =>
            item.transaction_type === transaction &&
            `${item.title} ${item.neighborhood}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()) &&
            (!neighborhood || item.neighborhood === neighborhood) &&
            (!maxPrice || item.price_minor <= Number(maxPrice) * 100) &&
            (!rooms || item.rooms >= Number(rooms)) &&
            (!propertyType || item.property_type === propertyType),
        )
        .sort((a, b) =>
          sort === "price-asc"
            ? a.price_minor - b.price_minor
            : sort === "price-desc"
              ? b.price_minor - a.price_minor
              : sort === "area"
                ? b.area_sqm - a.area_sqm
                : 0,
        ),
    [
      listings,
      transaction,
      query,
      neighborhood,
      maxPrice,
      rooms,
      propertyType,
      sort,
    ],
  );
  const activeFilters = [neighborhood, maxPrice, rooms, propertyType].filter(
    Boolean,
  ).length;
  const catalogueMapPath = useMemo(
    () =>
      buildMapPathFromCatalogueFilters({
        transaction,
        q: query,
        neighborhood,
        maxPrice,
        rooms,
        propertyType,
      }),
    [
      transaction,
      query,
      neighborhood,
      maxPrice,
      rooms,
      propertyType,
    ],
  );
  useEffect(() => {
    setCatalogueMapPath(catalogueMapPath);
  }, [catalogueMapPath, setCatalogueMapPath]);
  const clear = () => {
    setQuery("");
    setNeighborhood("");
    setMaxPrice("");
    setRooms("");
    setPropertyType("");
  };
  return (
    <main id="main">
      <section className="hero page-width">
        <div className="hero-content">
          <div className="eyebrow">
            <span className="tiny-line" />
            {t(
              "LOCUINȚE. OAMENI. NOI ÎNCEPUTURI.",
              "HOMES. PEOPLE. NEW BEGINNINGS.",
            )}
          </div>
          <h1>
            {t("Locul tău", "Your next chapter")}
            <br />
            {t("începe", "starts")} <em>{t("aici.", "here.")}</em>
          </h1>
          <p>
            {t(
              "Caută cu încredere. Alege în ritmul tău. Descoperă locuințe și oferte, direct de la proprietari.",
              "Look with confidence. Choose at your own pace. Discover homes and offers, directly from owners.",
            )}
          </p>
        </div>
        <div className="hero-aside">
          <div className="hero-note">
            <span className="note-number">01 — 06</span>
            <span>
              {t("Cartiere cu personalitate.", "Neighborhoods with character.")}
              <br />
              {t("Locuri cu poveste.", "Places with a story.")}
            </span>
            <ArrowDown size={22} strokeWidth={1.3} />
          </div>
          <div className="city-label">
            <MapPin size={14} />
            {t("BUCUREȘTI, ROMÂNIA", "BUCHAREST, ROMANIA")}
            <span className="status-dot" />
          </div>
        </div>
      </section>
      <CatalogueMap listings={listings} mapHref={catalogueMapPath} />
      <section
        id="catalogue-listings"
        className="catalogue-section page-width"
        aria-label={t("Catalog de proprietăți", "Property catalogue")}
      >
        <div className="search-panel">
          <div
            className="transaction-tabs"
            role="tablist"
            aria-label={t("Tip tranzacție", "Transaction type")}
          >
            <button
              role="tab"
              aria-selected={transaction === "sale"}
              className={transaction === "sale" ? "active" : ""}
              onClick={() => {
                setTransaction("sale");
                setMaxPrice("");
              }}
            >
              {t("Cumpără", "Buy")}
              <ArrowUpRight size={15} />
            </button>
            <button
              role="tab"
              aria-selected={transaction === "rent"}
              className={transaction === "rent" ? "active" : ""}
              onClick={() => {
                setTransaction("rent");
                setMaxPrice("");
              }}
            >
              {t("Închiriază", "Rent")}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="search-fields">
            <label className="main-search">
              <Search size={21} />
              <span className="sr-only">
                {t(
                  "Caută după cartier sau locuință",
                  "Search neighborhood or home",
                )}
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t(
                  "În ce cartier te vezi acasă?",
                  "Which neighborhood feels like home?",
                )}
              />
            </label>
            <label className="compact-filter">
              <span>{t("BUGET MAXIM", "MAXIMUM BUDGET")}</span>
              <select
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                aria-label={t("Buget maxim", "Maximum budget")}
              >
                <option value="">{t("Orice buget", "Any budget")}</option>
                {(transaction === "sale"
                  ? [150000, 250000, 350000, 500000]
                  : [700, 1000, 1500, 2500]
                ).map((price) => (
                  <option key={price} value={price}>
                    {money(price * 100, language)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={`filter-button ${advanced ? "selected" : ""}`}
              onClick={() => setAdvanced(!advanced)}
              aria-expanded={advanced}
            >
              <SlidersHorizontal size={18} />
              {t("Filtre", "Filters")}
              {activeFilters > 0 && (
                <span className="filter-count">{activeFilters}</span>
              )}
            </button>
            <button
              className="search-button"
              onClick={() =>
                document
                  .getElementById("results")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {t("Descoperă", "Explore")}
              <ArrowRight size={18} />
            </button>
          </div>
          {advanced && (
            <div className="advanced-filters">
              <label>
                {t("Cartier", "Neighborhood")}
                <select
                  aria-label={t("Cartier", "Neighborhood")}
                  value={neighborhood}
                  onChange={(event) => setNeighborhood(event.target.value)}
                >
                  <option value="">
                    {t("Toate cartierele", "All neighborhoods")}
                  </option>
                  {neighborhoods.map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("Camere", "Rooms")}
                <select
                  aria-label={t("Camere", "Rooms")}
                  value={rooms}
                  onChange={(event) => setRooms(event.target.value)}
                >
                  <option value="">{t("Oricâte camere", "Any number")}</option>
                  {[2, 3, 4, 5].map((count) => (
                    <option value={count} key={count}>
                      {count}+
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Tip proprietate", "Property type")}
                <select
                  aria-label={t("Tip proprietate", "Property type")}
                  value={propertyType}
                  onChange={(event) => setPropertyType(event.target.value)}
                >
                  <option value="">
                    {t("Toate tipurile", "All property types")}
                  </option>
                  <option value="apartment">
                    {t("Apartament", "Apartment")}
                  </option>
                  <option value="house">{t("Casă", "House")}</option>
                </select>
              </label>
              <button className="text-button" onClick={clear}>
                <X size={14} />
                {t("Resetează", "Reset filters")}
              </button>
            </div>
          )}
        </div>
        <div id="results" className="results-heading">
          <div>
            <div className="eyebrow">
              {t("DESCOPERĂ CE ȚI SE POTRIVEȘTE", "FIND YOUR KIND OF PLACE")}
            </div>
            <h2>
              {t("Case cu", "Homes with")}{" "}
              <em>{t("posibilități.", "possibilities.")}</em>
              <span className="result-count">{filtered.length}</span>
            </h2>
          </div>
          <label className="sort-control">
            <span>{t("Sortează:", "Sort:")}</span>
            <select
              aria-label={t("Sortează proprietățile", "Sort properties")}
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recommended">
                {t("Recomandate", "Recommended")}
              </option>
              <option value="price-asc">
                {t("Preț crescător", "Price: low to high")}
              </option>
              <option value="price-desc">
                {t("Preț descrescător", "Price: high to low")}
              </option>
              <option value="area">
                {t("Suprafață descrescătoare", "Largest area")}
              </option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        {filtered.length ? (
          <div className="property-grid">
            {filtered.map((listing, index) => (
              <PropertyCard
                key={listing.id}
                listing={listing}
                priority={index < 3}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Search size={30} />
            <h3>
              {t(
                "Locul potrivit merită căutat.",
                "Your place is worth looking for.",
              )}
            </h3>
            <p>
              {t(
                "Nu am găsit locuințe pentru aceste filtre. Încearcă un buget sau un cartier diferit.",
                "No homes match these filters. Try a different budget or neighborhood.",
              )}
            </p>
            <button className="button primary" onClick={clear}>
              {t("Resetează filtrele", "Reset filters")}
            </button>
          </div>
        )}
        <div className="catalogue-end">
          <span />
          <span>
            {t(
              "Fiecare locuință, un nou început.",
              "Every home, a new beginning.",
            )}
          </span>
          <span />
        </div>
      </section>
      <section className="how-it-works page-width">
        <div>
          <div className="eyebrow">
            {t("MAI CLAR. MAI APROAPE.", "A LITTLE CLEARER. A LITTLE CLOSER.")}
          </div>
          <h2>
            {t("O casă se alege", "A home is a choice")}
            <br />
            <em>{t("cu încredere.", "made with confidence.")}</em>
          </h2>
          <Link href="/account" className="text-link">
            {t("Fă primul pas", "Take the first step")}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="steps">
          <div>
            <span>01</span>
            <div>
              <h3>
                {t("Descoperă în ritmul tău", "Explore at your own pace")}
              </h3>
              <p>
                {t(
                  "Compară locuințe, salvează favorite și programează o vizionare.",
                  "Compare homes, save your favorites, and arrange a viewing.",
                )}
              </p>
            </div>
          </div>
          <div>
            <span>02</span>
            <div>
              <h3>
                {t(
                  "Discută direct. Oferă informat.",
                  "Talk directly. Make an informed offer.",
                )}
              </h3>
              <p>
                {t(
                  "Oferte publice ascendente sau confidențiale. Regulile sunt vizibile înainte să participi.",
                  "Public ascending or confidential offers. See the rules before you take part.",
                )}
              </p>
            </div>
          </div>
          <div>
            <span>03</span>
            <div>
              <h3>
                {t("Următorul pas, împreună", "Take the next step together")}
              </h3>
              <p>
                {t(
                  "Proprietarul selectează oferta după închidere. Rezervările sunt doar simulate, fără bani reali.",
                  "The owner selects an offer after closing. Reservations are simulated, with no real money.",
                )}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
export function PropertyCard({
  listing,
  priority = false,
}: {
  listing: Listing;
  priority?: boolean;
}) {
  const { t, language, viewer, configured, favorites, setFavoriteSaved } =
    usePlatform();
  const saved = favorites.includes(listing.id);
  const [localError, setLocalError] = useState("");
  const { mutate, busy, error } = useMutation();
  const save = async () => {
    if (!configured) {
      setLocalError(
        t(
          "Catalog demonstrativ. Conectează Supabase pentru a salva favorite.",
          "Demo catalogue. Connect Supabase to save favorites.",
        ),
      );
      return;
    }
    if (!viewer) {
      setLocalError(
        t(
          "Intră în cont pentru a salva această locuință.",
          "Sign in to save this home.",
        ),
      );
      return;
    }
    if (
      await mutate("set_favorite", {
        p_listing_id: listing.id,
        p_saved: !saved,
      })
    )
      setFavoriteSaved(listing.id, !saved);
  };
  return (
    <article className="property-card">
      <div className="card-image">
        <Link
          href={`/listings/${listing.id}`}
          aria-label={listingTitle(listing, language)}
        >
          {listing.image_urls[0] ? (
            <img
              src={listing.image_urls[0]}
              alt={listingTitle(listing, language)}
              loading={priority ? "eager" : "lazy"}
            />
          ) : (
            <span className="photo-placeholder">
              <Home size={35} strokeWidth={1} />
              <span>{t("Fotografii în curând", "Photos not provided")}</span>
            </span>
          )}
        </Link>
        <div className="card-badges">
          {listing.auction_mode && (
            <span
              className={`badge ${listing.auction_mode === "sealed" ? "badge-navy" : "badge-coral"}`}
            >
              <span className="status-dot" />
              {listing.auction_mode === "sealed"
                ? t("Ofertă confidențială", "Confidential offer")
                : t("Licitație deschisă", "Open bidding")}
            </span>
          )}
          {listing.tenancy_status === "occupied" && (
            <span className="badge">{t("Cu chiriaș", "Tenanted")}</span>
          )}
        </div>
        <button
          className={`save-button ${saved ? "saved" : ""}`}
          disabled={busy}
          onClick={save}
          aria-label={
            saved
              ? t("Elimină din favorite", "Remove favorite")
              : t("Salvează locuința", "Save home")
          }
          aria-pressed={saved}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="photo-count">
          {String(listing.image_urls.length).padStart(2, "0")}{" "}
          {t("FOTOGRAFII", "PHOTOS")}
        </span>
      </div>
      <div className="card-body">
        <div className="location">
          <MapPin size={13} />
          {listing.neighborhood} <span>· {t("București", "Bucharest")}</span>
        </div>
        <h3>
          <Link href={`/listings/${listing.id}`}>
            {listingTitle(listing, language)}
          </Link>
        </h3>
        <div className="property-specs">
          <span>
            <BedDouble size={15} />
            {listing.rooms} {t("camere", "rooms")}
          </span>
          <span>
            <Square size={14} />
            {listing.area_sqm} m²
          </span>
          <span>
            {listing.property_type === "house"
              ? t("Casă", "House")
              : t("Apartament", "Apartment")}
          </span>
        </div>
        <div className="card-bottom">
          <div className="property-price">
            {money(listing.price_minor, language)}
            {listing.transaction_type === "rent" ? (
              <small> / {t("lună", "month")}</small>
            ) : (
              <small className="price-total">
                {" "}
                {t("preț total", "total price")}
              </small>
            )}
          </div>
          <Link
            className="card-arrow"
            href={`/listings/${listing.id}`}
            aria-label={t("Vezi locuința", "View home")}
          >
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <Feedback error={error || localError} />
      </div>
    </article>
  );
}
