"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Home,
  Images,
  KeyRound,
  LockKeyhole,
  MapPin,
  Maximize2,
  FileText,
  MessageCircle,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import type { Listing } from "@/lib/types";
import {
  listingDocumentQualificationRow,
  listingOwnerChannelBullet,
} from "@/lib/listing-detail-facts";
import { formatPricePerSqm } from "@/lib/listing-price-per-sqm";
import { listingDescription, listingTitle } from "@/lib/i18n";
import { dateTime, money } from "@/lib/format";
import {
  useAllowsOptionalContent,
} from "@/components/disclosures/cookie-consent-banner";
import { openCookiePreferences } from "@/lib/optional-content-events";
import { Feedback, useMutation, usePlatform } from "./platform";
import { AuctionCountdown, useAuctionCountdown } from "./auction-countdown";
import { ListingDetailMap } from "./map/listing-detail-map";
import { buildAccountSignInUrl } from "@/lib/security";
export function ListingDetail({ listing }: { listing: Listing }) {
  const { language, t, configured, viewer, favorites, setFavoriteSaved } =
    usePlatform();
  const allowsOptionalContent = useAllowsOptionalContent();
  const router = useRouter();
  const [gallery, setGallery] = useState<number | null>(null);
  const [tab, setTab] = useState<"message" | "viewing">("message");
  const clock = useAuctionCountdown(listing);
  const [viewingNow, setViewingNow] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const tourSource = (listing as Listing & { tour_url?: string | null })
    .tour_url;
  let safeTour: string | null = null;
  try {
    if (tourSource) {
      const url = new URL(tourSource);
      if (
        url.protocol === "https:" &&
        ((["kuula.co", "www.kuula.co"].includes(url.hostname) && url.pathname.startsWith("/share/")) ||
          (url.hostname === "my.matterport.com" &&
            url.pathname === "/show/" &&
            Boolean(url.searchParams.get("m"))))
      )
        safeTour = url.toString();
    }
  } catch {
    /* Invalid provider URLs are never embedded. */
  }
  const saved = favorites.includes(listing.id);
  const [saveError, setSaveError] = useState("");
  const mutation = useMutation();
  const contact = useMutation();
  const favorite = useMutation();
  const closeGalleryRef = useRef<HTMLButtonElement>(null);
  // Local input hint only; auction eligibility uses the server-sampled clock above.
  useEffect(() => {
    const first = setTimeout(() => setViewingNow(Date.now()), 0);
    const timer = setInterval(() => setViewingNow(Date.now()), 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (gallery === null) return;
    const before = document.activeElement as HTMLElement | null;
    closeGalleryRef.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setGallery(null);
      if (event.key === "ArrowRight")
        setGallery((value) =>
          value === null ? null : (value + 1) % listing.image_urls.length,
        );
      if (event.key === "ArrowLeft")
        setGallery((value) =>
          value === null
            ? null
            : (value - 1 + listing.image_urls.length) %
              listing.image_urls.length,
        );
      if (event.key === "Tab") {
        const nodes = document.querySelectorAll<HTMLButtonElement>(
          ".gallery-dialog button",
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("keydown", keyboard);
      document.body.style.overflow = oldOverflow;
      before?.focus();
    };
  }, [gallery, listing.image_urls.length]);
  const listingPath = `/listings/${listing.id}`;
  const clockLoading = clock.phase === "loading";
  const ended = clock.phase === "ended";
  const scheduled = clock.phase === "scheduled";
  const auctionLive = clock.phase === "live";
  const isOwner = Boolean(
    viewer?.id && listing.owner_id && viewer.id === listing.owner_id,
  );
  const canWrite = configured && !!viewer;
  const minimum =
    listing.current_bid_minor !== null
      ? listing.current_bid_minor + (listing.min_increment_minor || 0)
      : listing.starting_price_minor || listing.price_minor;
  const pricePerSqmLabel = formatPricePerSqm(
    listing.price_minor,
    listing.area_sqm,
    language,
    listing.transaction_type,
  );
  const submitBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await mutation.mutate(
        "place_bid",
        {
          p_auction_id: listing.auction_id,
          p_amount_minor: Math.round(Number(form.get("amount")) * 100),
        },
        t("Oferta ta a fost înregistrată.", "Your offer has been recorded."),
      )
    )
      router.refresh();
  };
  const submitContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const result =
      tab === "viewing"
        ? await contact.mutate(
            "request_viewing",
            {
              p_listing_id: listing.id,
              p_requested_at: new Date(
                String(form.get("requested_at")),
              ).toISOString(),
              p_message: String(form.get("body")),
            },
            t(
              "Cererea de vizionare a fost trimisă. Urmărește confirmarea în spațiul tău.",
              "Viewing request sent. Check your workspace for confirmation.",
            ),
          )
        : await contact.mutate(
            "send_message",
            {
              p_listing_id: listing.id,
              p_body: String(form.get("body")),
              p_conversation_id: null,
            },
            t(
              "Mesaj trimis. Continuă conversația în spațiul tău.",
              "Message sent. Continue the conversation in your workspace.",
            ),
          );
    if (result) element.reset();
  };
  const save = async () => {
    if (!canWrite) {
      setSaveError(
        configured
          ? t(
              "Intră în cont pentru a salva locuința.",
              "Sign in to save this home.",
            )
          : t(
              "Salvarea este disponibilă după conectarea Supabase.",
              "Saving is available after Supabase is connected.",
            ),
      );
      return;
    }
    if (
      await favorite.mutate("set_favorite", {
        p_listing_id: listing.id,
        p_saved: !saved,
      })
    )
      setFavoriteSaved(listing.id, !saved);
  };
  return (
    <main id="main" className="detail-page page-width">
      <div className="detail-breadcrumb">
        <Link href="/">
          <ArrowLeft size={15} />
          {t("Înapoi la locuințe", "Back to homes")}
        </Link>
        <span>
          {listing.neighborhood}, {t("București", "Bucharest")}
        </span>
        <button className="text-button" onClick={save} disabled={favorite.busy}>
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
          {saved ? t("Salvată", "Saved") : t("Salvează", "Save")}
        </button>
      </div>
      <p className="detail-report-link muted">
        <Link href={`/listings/${listing.id}/report`}>
          {t(
            "Raportează conținut ilegal",
            "Report illegal content",
          )}
        </Link>
      </p>
      <Feedback error={saveError || favorite.error} />
      <div className="detail-title">
        <div>
          <div className="eyebrow">
            {listing.transaction_type === "sale"
              ? t("DE VÂNZARE", "FOR SALE")
              : t("DE ÎNCHIRIAT", "FOR RENT")}
            <span> / </span>
            {listing.neighborhood.toUpperCase()}
          </div>
          <h1>{listingTitle(listing, language)}</h1>
          <p>
            <MapPin size={15} />
            {listing.neighborhood},{" "}
            {t(
              "București · Localizare aproximativă",
              "Bucharest · Approximate location",
            )}
          </p>
        </div>
        <div className="detail-price">
          {money(listing.price_minor, language)}
          <span>
            {listing.transaction_type === "rent"
              ? t("EUR / lună", "EUR / month")
              : t("EUR · preț total", "EUR · total asking price")}
          </span>
        </div>
      </div>
      {listing.image_urls.length > 0 ? (
        <div className="detail-gallery">
          <button
            className="gallery-main"
            onClick={() => setGallery(0)}
            aria-label={t("Deschide galeria foto", "Open photo gallery")}
          >
            <img
              src={listing.image_urls[0]}
              alt={listingTitle(listing, language)}
            />
            <span className="gallery-expand">
              <Maximize2 size={18} />
            </span>
          </button>
          <div className="gallery-side">
            {listing.image_urls.slice(1, 3).map((url, index) => (
              <button
                key={`${url}-${index}`}
                onClick={() => setGallery(index + 1)}
                aria-label={t(
                  `Vezi fotografia ${index + 2}`,
                  `View photo ${index + 2}`,
                )}
              >
                <img
                  src={url}
                  alt={t(
                    `Interior, fotografia ${index + 2}`,
                    `Interior, photo ${index + 2}`,
                  )}
                />
              </button>
            ))}
            <button className="gallery-all" onClick={() => setGallery(0)}>
              <Images size={16} />
              {t("Toate fotografiile", "All photos")} (
              {listing.image_urls.length})
            </button>
          </div>
        </div>
      ) : (
        <div className="detail-no-photos">
          <Home size={45} strokeWidth={1} />
          <p>
            {t(
              "Proprietarul nu a adăugat încă fotografii.",
              "The owner has not provided photos yet.",
            )}
          </p>
        </div>
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-specs">
            <div>
              <BedDouble />
              <strong>{listing.rooms}</strong>
              <span>{t("camere", "rooms")}</span>
            </div>
            <div>
              <Square />
              <strong>{listing.area_sqm} m²</strong>
              <span>{t("suprafață utilă", "usable area")}</span>
            </div>
            {pricePerSqmLabel ? (
              <div data-testid="listing-price-per-sqm">
                <Square />
                <strong>{pricePerSqmLabel}</strong>
                <span>{t("preț pe m²", "price per m²")}</span>
              </div>
            ) : null}
            <div>
              <KeyRound />
              <strong>
                {listing.floor === 0 ? t("Parter", "Ground") : listing.floor}
              </strong>
              <span>{t("etaj", "floor")}</span>
            </div>
            <div>
              <CalendarDays />
              <strong>{listing.built_year}</strong>
              <span>{t("an construcție", "year built")}</span>
            </div>
          </div>
          <section className="detail-section">
            <div className="eyebrow">
              {t("IMAGINEAZĂ-ȚI VIAȚA AICI", "IMAGINE YOUR LIFE HERE")}
            </div>
            <h2>
              {t("Un loc de numit", "A place to call")}{" "}
              <em>{t("acasă.", "home.")}</em>
            </h2>
            <p className="description">
              {listingDescription(listing, language)}
            </p>
            <div className="highlight-row">
              <span>
                <Check size={15} />
                {listing.property_type === "house"
                  ? t("Casă", "House")
                  : t("Apartament", "Apartment")}
              </span>
              <span>
                <Check size={15} />
                {listing.tenancy_status === "occupied"
                  ? t(
                      "Cu chiriaș · vânzare investiție",
                      "Tenanted · investment sale",
                    )
                  : t("Fără chiriaș", "Vacant property")}
              </span>
              <span data-testid="listing-owner-channel-bullet">
                <MessageCircle size={15} />
                {t(
                  listingOwnerChannelBullet.ro,
                  listingOwnerChannelBullet.en,
                )}
              </span>
              <span data-testid="listing-document-qualification-row">
                <FileText size={15} />
                {t(
                  listingDocumentQualificationRow.ro,
                  listingDocumentQualificationRow.en,
                )}
              </span>
            </div>
          </section>
          <section className="detail-section">
            <h3>
              {t(
                "Cartierul face diferența.",
                "A neighborhood makes a difference.",
              )}
            </h3>
            <div className="neighborhood-card">
              <ListingDetailMap listing={listing} />
              <div>
                <span className="eyebrow">
                  {t("ZONĂ APROXIMATIVĂ", "APPROXIMATE AREA")}
                </span>
                <h3>{listing.neighborhood}</h3>
                <p>
                  {t(
                    "București, România. Adresa exactă rămâne privată. Cere detalii proprietarului înainte de vizionare.",
                    "Bucharest, Romania. The exact address stays private. Ask the owner for details before your viewing.",
                  )}
                </p>
              </div>
            </div>
            {safeTour ? (
              <div className="virtual-tour">
                <div className="tour-heading">
                  <div>
                    <h3>
                      {t(
                        "Privește în jur. De oriunde.",
                        "Take a look around. From anywhere.",
                      )}
                    </h3>
                    <p>
                      {t(
                        "Turul este găzduit de un furnizor extern. Se încarcă doar când îl deschizi și atunci partajează date de conexiune cu furnizorul.",
                        "This tour is hosted by an external provider. It loads only when you open it, sharing connection data with that provider.",
                      )}
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => {
                      if (!allowsOptionalContent) {
                        openCookiePreferences();
                        return;
                      }
                      setTourOpen(!tourOpen);
                    }}
                  >
                    {tourOpen
                      ? t("Închide turul", "Close tour")
                      : t("Deschide turul 360°", "Open 360° tour")}
                    <Maximize2 size={15} />
                  </button>
                </div>
                {tourOpen && allowsOptionalContent && (
                  <iframe
                    className="tour-embed"
                    src={safeTour}
                    title={t(
                      "Tur virtual al proprietății",
                      "Property virtual tour",
                    )}
                    loading="lazy"
                    allow="fullscreen; accelerometer; gyroscope"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
                    referrerPolicy="no-referrer"
                  />
                )}
                <a
                  className="text-link"
                  href={safeTour}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    if (!allowsOptionalContent) {
                      event.preventDefault();
                      openCookiePreferences();
                    }
                  }}
                >
                  {t(
                    "Deschide pe site-ul furnizorului",
                    "Open on the provider’s website",
                  )}
                  <ArrowUpRight size={14} />
                </a>
              </div>
            ) : (
              <p className="muted small">
                {t(
                  "Tur virtual: nu a fost furnizat de proprietar.",
                  "Virtual tour: not provided by the owner.",
                )}
              </p>
            )}
          </section>
          <section className="detail-section contact-section" id="contact">
            <div className="eyebrow">
              {t("O CONVERSAȚIE E UN ÎNCEPUT", "A CONVERSATION IS A START")}
            </div>
            <h2>
              {t("Hai să vorbim", "Let’s talk")}{" "}
              <em>{t("despre asta.", "about it.")}</em>
            </h2>
            <div className="segmented-tabs">
              <button
                className={tab === "message" ? "active" : ""}
                onClick={() => {
                  setTab("message");
                  contact.clear();
                }}
              >
                <MessageCircle size={16} />
                {t("Trimite un mesaj", "Send a message")}
              </button>
              <button
                className={tab === "viewing" ? "active" : ""}
                onClick={() => {
                  setTab("viewing");
                  contact.clear();
                }}
              >
                <CalendarDays size={16} />
                {t("Programează o vizionare", "Arrange a viewing")}
              </button>
            </div>
            {canWrite && !isOwner ? (
              <form onSubmit={submitContact} className="stack-form">
                {tab === "viewing" && (
                  <label>
                    {t("Data și ora preferată", "Preferred date and time")}
                    <input
                      name="requested_at"
                      type="datetime-local"
                      required
                      min={new Date(viewingNow + 3600000).toISOString().slice(0, 16)}
                    />
                  </label>
                )}
                <label>
                  {t("Mesaj pentru proprietar", "Message to the owner")}
                  <textarea
                    name="body"
                    rows={4}
                    minLength={2}
                    maxLength={tab === "viewing" ? 2000 : 3000}
                    required
                    placeholder={t(
                      "Bună! Aș dori mai multe detalii despre această locuință…",
                      "Hello! I’d like to know more about this home…",
                    )}
                  />
                </label>
                <Feedback error={contact.error} message={contact.message} />
                <button className="button primary" disabled={contact.busy}>
                  {contact.busy
                    ? t("Se trimite…", "Sending…")
                    : tab === "message"
                      ? t("Trimite mesajul", "Send message")
                      : t("Solicită vizionarea", "Request viewing")}
                  <ArrowUpRight size={16} />
                </button>
              </form>
            ) : (
              <div className="signin-notice">
                <LockKeyhole size={22} />
                <p>
                  {isOwner
                    ? t(
                        "Aceasta este locuința ta. Gestionează mesajele și vizionările din spațiul tău.",
                        "This is your home. Manage messages and viewings from your workspace.",
                      )
                    : configured
                      ? t(
                          "Intră în cont pentru mesaje și vizionări.",
                          "Sign in to send messages and request viewings.",
                        )
                      : t(
                          "Catalog demonstrativ. Mesajele și vizionările sunt disponibile după conectarea Supabase.",
                          "Demo catalogue. Messages and viewings become available after Supabase is connected.",
                        )}
                </p>
                <Link
                  className="text-link"
                  href={isOwner ? "/workspace" : "/account"}
                >
                  {isOwner
                    ? t("Spațiul meu", "My workspace")
                    : t("Intră în cont", "Sign in")}
                  <ArrowRight size={15} />
                </Link>
              </div>
            )}
          </section>
        </div>
        <aside className="offer-sidebar">
          <div className="offer-panel" data-tour="offer-panel">
            {listing.auction_id ? (
              <>
                <div className="offer-panel-top">
                  <span
                    className={`badge ${listing.auction_mode === "sealed" ? "badge-navy" : "badge-coral"}`}
                  >
                    <span className="status-dot" />
                    {listing.auction_mode === "sealed"
                      ? t("OFERTE CONFIDENȚIALE", "CONFIDENTIAL OFFERS")
                      : t("LICITAȚIE ASCENDENTĂ", "ASCENDING AUCTION")}
                  </span>
                  {listing.auction_access === "invite" && (
                    <span className="access-label">
                      <LockKeyhole size={13} />
                      {t("Doar cu invitație", "Invitation only")}
                    </span>
                  )}
                </div>
                <h3>
                  {clockLoading
                    ? t("Se încarcă…", "Loading…")
                    : ended
                      ? t("Etapa de oferte s-a încheiat.", "Bidding has closed.")
                      : scheduled
                        ? t(
                            "În curând, un nou început.",
                            "A new beginning, coming soon.",
                          )
                        : t(
                            "Următorul pas îți aparține.",
                            "Your next step starts here.",
                          )}
                </h3>
                {listing.auction_mode === "sealed" ? (
                  <div className="confidential-notice">
                    <LockKeyhole size={19} />
                    <p>
                      {t(
                        "Valoarea ofertelor este confidențială. Doar proprietarul vede toate ofertele.",
                        "Offer amounts are confidential. Only the owner can see all offers.",
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="current-offer">
                    <span>
                      {t("Oferta publică actuală", "Current public offer")}
                    </span>
                    <strong>
                      {listing.current_bid_minor !== null
                        ? money(listing.current_bid_minor, language)
                        : t("Încă nu există oferte", "No offers yet")}
                    </strong>
                    <small>
                      {listing.bid_count}{" "}
                      {t("oferte înregistrate", "offers recorded")}
                    </small>
                  </div>
                )}
                <AuctionCountdown clock={clock} />
                {clock.endsAt && !ended && (
                  <p className="muted small">
                    {t("Se încheie", "Closes")}{" "}
                    {dateTime(clock.endsAt, language)}
                  </p>
                )}
                <p className="small" data-testid="auction-close-rule">
                  {listing.auction_mode === "ascending" && clock.softCloseSeconds > 0 && clock.maxEndsAt
                    ? t(
                        `Ofertele acceptate în ultimele ${clock.softCloseSeconds} s prelungesc termenul pentru a păstra ${clock.softCloseSeconds} s de participare, cel mult până la ${dateTime(clock.maxEndsAt, language)}. Serverul decide dacă oferta ajunge la timp.`,
                        `Accepted offers in the final ${clock.softCloseSeconds}s extend the deadline to leave ${clock.softCloseSeconds}s to participate, up to ${dateTime(clock.maxEndsAt, language)}. The server decides whether an offer arrives in time.`,
                      )
                    : t("Termen fix: ofertele nu prelungesc licitația. Serverul decide dacă oferta ajunge la timp.", "Fixed deadline: offers do not extend this auction. The server decides whether an offer arrives in time.")}
                </p>
                {listing.auction_mode === "ascending" && (
                  <p className="small">
                    {t("Pas minim:", "Minimum increment:")}{" "}
                    {money(listing.min_increment_minor || 0, language)}
                  </p>
                )}
                {canWrite && !isOwner && auctionLive ? (
                  <form onSubmit={submitBid} className="stack-form">
                    <label>
                      {t("Oferta ta în EUR", "Your offer in EUR")}
                      <div className="currency-input">
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          min={
                            listing.auction_mode === "ascending"
                              ? minimum / 100
                              : 0.01
                          }
                          required
                          placeholder={
                            listing.auction_mode === "ascending"
                              ? String(minimum / 100)
                              : "0"
                          }
                        />
                        <span>EUR</span>
                      </div>
                    </label>
                    <button className="button primary" disabled={mutation.busy}>
                      {mutation.busy
                        ? t("Se înregistrează…", "Submitting…")
                        : listing.auction_mode === "sealed"
                          ? t(
                              "Trimite oferta confidențială",
                              "Send confidential offer",
                            )
                          : t("Înregistrează oferta", "Place an offer")}
                      <ArrowUpRight size={16} />
                    </button>
                    <Feedback
                      error={mutation.error}
                      message={mutation.message}
                    />
                  </form>
                ) : isOwner ? (
                  <Link className="button primary" href="/workspace?tab=owner">
                    {t("Gestionează licitația", "Manage auction")}
                    <ArrowUpRight size={16} />
                  </Link>
                ) : auctionLive ? (
                  <Link
                    className="button primary"
                    href={buildAccountSignInUrl(listingPath)}
                  >
                    {t(
                      "Intră în cont pentru a participa",
                      "Sign in to participate",
                    )}
                    <ArrowUpRight size={16} />
                  </Link>
                ) : null}
                <p className="offer-fineprint">
                  {t(
                    "Proprietarul selectează oferta după închidere. Invitația și validarea contului sunt necesare unde se aplică. Ora și eligibilitatea sunt verificate de server.",
                    "The owner selects an offer after closing. An invitation and verified account are required where applicable. The server verifies timing and eligibility.",
                  )}
                </p>
              </>
            ) : (
              <>
                <span className="eyebrow">
                  {t("DIRECT DE LA PROPRIETAR", "DIRECTLY FROM THE OWNER")}
                </span>
                <h3>
                  {t(
                    "Unele locuri merită văzute.",
                    "Some places deserve a visit.",
                  )}
                </h3>
                <p className="muted">
                  {t(
                    "Nu există o licitație activă pentru acest anunț. Discută cu proprietarul și descoperă dacă ți se potrivește.",
                    "There is no active auction for this listing. Talk to the owner and see whether it feels right.",
                  )}
                </p>
                <a href="#contact" className="button primary">
                  {t("Contactează proprietarul", "Contact the owner")}
                  <ArrowRight size={16} />
                </a>
              </>
            )}
            <div className="simulation-note">
              <ShieldCheck size={18} />
              <span>
                {t(
                  "Rezervări doar simulate. Fără plăți, portofel sau transfer de bani reali.",
                  "Reservations are simulation only. No payments, wallet, or real money transfers.",
                )}
              </span>
            </div>
          </div>
          <div className="sidebar-help">
            <span className="mini-brand">
              l<span>.</span>
            </span>
            <p>
              {t(
                "Un loc al tău. Cu toate informațiile la vedere.",
                "A place of your own. With the details out in the open.",
              )}
            </p>
          </div>
        </aside>
      </div>
      {gallery !== null && (
        <div className="gallery-overlay" onClick={() => setGallery(null)}>
          <div
            className="gallery-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("Galerie de fotografii", "Photo gallery")}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeGalleryRef}
              className="gallery-close icon-button"
              onClick={() => setGallery(null)}
              aria-label={t("Închide galeria", "Close gallery")}
            >
              <X />
            </button>
            <img
              src={listing.image_urls[gallery]}
              alt={t(
                `Fotografia ${gallery + 1} a locuinței`,
                `Home photo ${gallery + 1}`,
              )}
            />
            <div className="gallery-controls">
              <button
                className="icon-button"
                onClick={() =>
                  setGallery(
                    (gallery - 1 + listing.image_urls.length) %
                      listing.image_urls.length,
                  )
                }
                aria-label={t("Fotografia precedentă", "Previous photo")}
              >
                <ChevronLeft />
              </button>
              <span>
                {gallery + 1} / {listing.image_urls.length}
              </span>
              <button
                className="icon-button"
                onClick={() =>
                  setGallery((gallery + 1) % listing.image_urls.length)
                }
                aria-label={t("Fotografia următoare", "Next photo")}
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
