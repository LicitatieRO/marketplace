"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Heart,
  Home,
  Inbox,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Listing, Workspace } from "@/lib/types";
import { dateTime, money } from "@/lib/format";
import { listingTitle } from "@/lib/i18n";
import { Feedback, useMutation, usePlatform } from "./platform";
import { PropertyCard } from "./catalogue";
import { PropertyPromoPanel } from "./payments/property-promo-panel";
import { SealedOfferComparison } from './sealed-offer-comparison';
type Row = Record<string, unknown>;
const str = (row: Row, key: string) => String(row[key] ?? "");
const num = (row: Row, key: string) => Number(row[key] ?? 0);
const short = (value: string) => (value ? `…${value.slice(-6)}` : "—");
const emptyWorkspace: Workspace = {
  profile: null,
  properties: [],
  listings: [],
  auctions: [],
  bids: [],
  reservations: [],
  conversations: [],
  messages: [],
  viewings: [],
  favorites: [],
  property_promos: [],
};
export function WorkspaceView({
  initialTab = "buyer",
}: {
  initialTab?: "buyer" | "owner";
}) {
  const { t, language, viewer, configured } = usePlatform();
  const [data, setData] = useState<Workspace>(emptyWorkspace);
  const [catalogue, setCatalogue] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"buyer" | "owner">(initialTab);
  const [editor, setEditor] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Row | null>(null);
  const [now, setNow] = useState(0);
  const [section, setSection] = useState("activity");
  const [conversation, setConversation] = useState<string | null>(null);
  const mutation = useMutation();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const load = useCallback(async () => {
    if (!configured || !viewer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [response, catalogueResponse] = await Promise.all([
        fetch("/api/workspace", { cache: "no-store" }),
        fetch("/api/catalogue", { cache: "no-store" }),
      ]);
      const [body, catalogueBody] = await Promise.all([
        response.json(),
        catalogueResponse.json(),
      ]);
      if (!response.ok || body.error)
        throw new Error(
          body.error ||
            t(
              "Nu am putut încărca spațiul tău.",
              "We could not load your workspace.",
            ),
        );
      setData({ ...emptyWorkspace, ...body.data });
      setCatalogue(catalogueBody.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Conexiune indisponibilă.", "Connection unavailable."),
      );
    } finally {
      setLoading(false);
    }
  }, [configured, viewer, t]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const act = async (action: string, payload: Row, success?: string) => {
    if (await mutation.mutate(action, payload, success)) await load();
  };
  const listingById = (id: string) => catalogue.find((item) => item.id === id);
  const listingName = (id: string) => {
    const item = listingById(id);
    return item
      ? listingTitle(item, language)
      : t("Locuință", "Home") + " " + short(id);
  };
  const auctionForBid = (bid: Row) =>
    data.auctions.find((item) => item.id === bid.auction_id);
  const selectedConversation =
    data.conversations.find((item) => item.id === conversation) ||
    data.conversations[0];
  if (!configured || !viewer)
    return (
      <main id="main" className="page-width workspace-gate">
        <span className="round-icon">
          <KeyRound />
        </span>
        <div className="eyebrow">
          {t(
            "TOT CE CONTEAZĂ, ÎNTR-UN LOC",
            "EVERYTHING THAT MATTERS, IN ONE PLACE",
          )}
        </div>
        <h1>
          {t("Spațiul tău.", "Your space.")}
          <br />
          <em>{t("Planurile tale.", "Your plans.")}</em>
        </h1>
        <p>
          {configured
            ? t(
                "Intră în cont pentru oferte, favorite, conversații și propriile anunțuri.",
                "Sign in for your offers, favorites, conversations, and your own listings.",
              )
            : t(
                "Catalogul demonstrativ îți arată produsul. Conectează Supabase pentru conturi și modificări persistente.",
                "The demo catalogue lets you explore the product. Connect Supabase for accounts and persistent changes.",
              )}
        </p>
        <Link href="/account" className="button primary">
          {t("Intră în cont", "Sign in")}
          <ArrowRight size={17} />
        </Link>
        <Link href="/" className="text-link">
          {t("Continuă explorarea", "Keep exploring")}
          <ArrowUpRight size={16} />
        </Link>
      </main>
    );
  return (
    <main id="main" className="workspace-page page-width">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">
            {t("UN PAS MAI APROAPE DE ACASĂ", "ONE STEP CLOSER TO HOME")}
          </div>
          <h1>
            {t("Salut,", "Hello,")}{" "}
            <em>{viewer.display_name || viewer.email.split("@")[0]}.</em>
          </h1>
          <p>
            {t(
              "Locuințele, conversațiile și pașii tăi următori.",
              "Your homes, conversations, and next steps.",
            )}
          </p>
        </div>
        <div className="workspace-heading-actions">
          <button
            className="icon-button"
            onClick={() => void load()}
            disabled={loading}
            aria-label={t("Reîncarcă", "Refresh")}
          >
            <RefreshCw className={loading ? "spin" : ""} size={19} />
          </button>
          <Link href="/account" className="text-link">
            {t("Contul meu", "My account")}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <div className="simulation-banner">
        <ShieldCheck size={21} />
        <div>
          <strong>
            {t(
              "Doar simulare. Fără bani reali.",
              "Simulation only. No real money.",
            )}
          </strong>
          <p>
            {t(
              "Finanțarea și rambursările sunt stări demonstrative. Semnarea necesită confirmarea ambelor părți; contractul juridic se încheie în afara platformei.",
              "Funding and refunds are simulated states. Signing requires both parties’ confirmation; the legal contract is handled outside the platform.",
            )}
          </p>
        </div>
      </div>
      <div className="workspace-tabs">
        <button
          className={tab === "buyer" ? "active" : ""}
          onClick={() => {
            setTab("buyer");
            setSection("activity");
            window.history.replaceState(null, "", "/workspace");
          }}
        >
          <Heart size={17} />
          {t("Caut o locuință", "Finding a home")}
        </button>
        <button
          className={tab === "owner" ? "active" : ""}
          onClick={() => {
            setTab("owner");
            setSection("activity");
            window.history.replaceState(null, "", "/workspace?tab=owner");
          }}
        >
          <Home size={17} />
          {t("Sunt proprietar", "My properties")}
          <span className="tab-count">{data.properties.length}</span>
        </button>
      </div>
      <Feedback error={error || mutation.error} message={mutation.message} />
      {loading ? (
        <div className="loading-state" role="status">
          <LoaderCircle className="spin" />
          {t("Se încarcă spațiul tău…", "Loading your workspace…")}
        </div>
      ) : (
        <>
          {tab === "owner" && (
            <>
              <div className="workspace-section-title">
                <div>
                  <h2>{t("Locurile tale.", "Your places.")}</h2>
                  <p className="muted">
                    {t(
                      "O proprietate, două opțiuni: vânzare și închiriere, legate între ele.",
                      "One property, two possibilities: linked sale and rental listings.",
                    )}
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    setEditingProperty(null);
                    setEditor(!editor);
                  }}
                >
                  {editor ? <X size={16} /> : <Plus size={16} />}{" "}
                  {editor
                    ? t("Închide editorul", "Close editor")
                    : t("Adaugă o proprietate", "Add a property")}
                </button>
              </div>
              {editor && (
                <PropertyEditor
                  key={editingProperty ? str(editingProperty, "id") : "new"}
                  property={editingProperty}
                  listings={data.listings}
                  onSaved={async () => {
                    setEditor(false);
                    setEditingProperty(null);
                    await load();
                  }}
                />
              )}
              <div className="owned-properties">
                {data.properties.length ? (
                  data.properties.map((property) => (
                    <article
                      className="owned-property"
                      key={str(property, "id")}
                    >
                      <div className="owned-property-heading">
                        <span className="round-icon">
                          <Home size={21} />
                        </span>
                        <div>
                          <h3>{str(property, "title")}</h3>
                          <span>
                            {str(property, "neighborhood")} ·{" "}
                            {num(property, "area_sqm")} m² ·{" "}
                            {num(property, "rooms")} {t("camere", "rooms")}
                          </span>
                        </div>
                        <span className="badge">
                          {str(property, "tenancy_status") === "occupied"
                            ? t("Cu chiriaș", "Tenanted")
                            : t("Disponibilă", "Vacant")}
                        </span>
                      </div>
                      <button
                        className="text-button edit-property-button"
                        onClick={() => {
                          setEditingProperty(property);
                          setEditor(true);
                          window.scrollTo({ top: 200, behavior: "smooth" });
                        }}
                      >
                        {t("Editează proprietatea", "Edit property")}
                        <ArrowUpRight size={13} />
                      </button>
                      <div className="private-address">
                        <LockKeyhole size={13} />
                        {t("Adresă privată:", "Private address:")}{" "}
                        {str(property, "exact_address")}
                      </div>
                      <div className="owned-listings">
                        {data.listings
                          .filter((item) => item.property_id === property.id)
                          .map((listing) => (
                            <div key={str(listing, "id")}>
                              <div>
                                <span>
                                  {str(listing, "transaction_type") === "rent"
                                    ? t("Închiriere", "Rental")
                                    : t("Vânzare", "Sale")}
                                </span>
                                <strong>
                                  {money(num(listing, "price_minor"), language)}
                                  {str(listing, "transaction_type") === "rent"
                                    ? ` / ${t("lună", "month")}`
                                    : ""}
                                </strong>
                                <small>
                                  {statusLabel(str(listing, "status"), t)}
                                </small>
                              </div>
                              <Link
                                className="text-link"
                                href={`/listings/${str(listing, "id")}`}
                              >
                                {t("Vezi anunțul", "View listing")}
                                <ArrowUpRight size={15} />
                              </Link>
                            </div>
                          ))}
                      </div>
                      <PropertyPromoPanel
                        propertyId={str(property, "id")}
                        promos={data.property_promos ?? []}
                        onComplete={load}
                      />
                    </article>
                  ))
                ) : (
                  <Empty
                    icon={<Home />}
                    title={t(
                      "Primul anunț începe cu tine.",
                      "Your first listing starts with you.",
                    )}
                    text={t(
                      "Adaugă o proprietate și un preț de vânzare, de închiriere sau ambele.",
                      "Add a property with a sale price, a rental price, or both.",
                    )}
                  />
                )}
              </div>
              {data.listings.length > 0 && (
                <AuctionEditor listings={data.listings} onSaved={load} />
              )}
              <section className="workspace-section">
                <h2>{t("Licitațiile tale", "Your auctions")}</h2>
                {data.auctions.filter(
                  (item) =>
                    item.owner_id === viewer.id ||
                    data.listings.some(
                      (listing) => listing.id === item.listing_id,
                    ),
                ).length ? (
                  data.auctions
                    .filter(
                      (item) =>
                        item.owner_id === viewer.id ||
                        data.listings.some(
                          (listing) => listing.id === item.listing_id,
                        ),
                    )
                    .map((auction) => (
                      <article className="auction-row" key={str(auction, "id")}>
                        <div>
                          <h3>{listingName(str(auction, "listing_id"))}</h3>
                          <div className="row-meta">
                            <span>
                              {str(auction, "mode") === "sealed"
                                ? t("Confidențială", "Confidential")
                                : t("Ascendentă", "Ascending")}
                            </span>
                            <span>
                              {str(auction, "access") === "invite"
                                ? t("Doar cu invitație", "Invitation only")
                                : t("Acces public", "Public access")}
                            </span>
                            <span>
                              {statusLabel(str(auction, "status"), t)}
                            </span>
                          </div>
                          <p className="muted small">
                            {t("Închidere:", "Closes:")}{" "}
                            {dateTime(str(auction, "ends_at"), language)}
                          </p>
                        </div>
                        {str(auction, "access") === "invite" && (
                          <form
                            className="inline-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const form = new FormData(event.currentTarget);
                              void act(
                                "invite_bidder",
                                {
                                  p_auction_id: auction.id,
                                  p_email: form.get("email"),
                                },
                                t(
                                  "Invitația a fost înregistrată pentru contul verificat.",
                                  "Invitation recorded for the verified account.",
                                ),
                              );
                            }}
                          >
                            <label>
                              <span className="sr-only">
                                {t("Emailul invitatului", "Invitee email")}
                              </span>
                              <input
                                name="email"
                                type="email"
                                placeholder={t(
                                  "Email cont verificat",
                                  "Verified account email",
                                )}
                                required
                              />
                            </label>
                            <button
                              className="button secondary"
                              disabled={mutation.busy}
                            >
                              {t("Invită", "Invite")}
                              <ArrowUpRight size={14} />
                            </button>
                          </form>
                        )}
                      </article>
                    ))
                ) : (
                  <p className="empty-inline">
                    {t(
                      "Nicio licitație încă. Creează una pentru un anunț de mai sus.",
                      "No auctions yet. Create one for a listing above.",
                    )}
                  </p>
                )}
              </section>
              {data.auctions.filter(auction => auction.mode === 'sealed' && auction.owner_id === viewer.id).map(auction => (
                <SealedOfferComparison key={str(auction, 'id')} auctionId={str(auction, 'id')} title={listingName(str(auction, 'listing_id'))} />
              ))}
              <section className="workspace-section">
                <h2>{t("Oferte primite", "Received offers")}</h2>
                <p className="muted small">
                  {t(
                    "După închidere, selectează oferta câștigătoare. Pentru licitația ascendentă se poate selecta doar oferta cea mai mare.",
                    "Select an offer after the auction closes. Ascending auctions allow only the highest offer to be selected.",
                  )}
                </p>
                {data.bids
                  .filter((bid) => {
                    const auction = auctionForBid(bid);
                    return (
                      auction &&
                      data.listings.some(
                        (listing) => listing.id === auction.listing_id,
                      )
                    );
                  })
                  .map((bid) => (
                    <div className="bid-row" key={str(bid, "id")}>
                      <div>
                        <strong>
                          {money(num(bid, "amount_minor"), language)}
                        </strong>
                        <span>
                          {listingName(
                            str(auctionForBid(bid) || {}, "listing_id"),
                          )}{" "}
                          · {t("Participant", "Bidder")}{" "}
                          {short(str(bid, "bidder_id"))}
                        </span>
                      </div>
                      <form
                        className="inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          void act(
                            "request_reservation",
                            {
                              p_bid_id: bid.id,
                              p_deposit_minor: Math.round(
                                Number(form.get("deposit")) * 100,
                              ),
                            },
                            t(
                              "Cererea de rezervare simulată a fost trimisă.",
                              "Simulated reservation request sent.",
                            ),
                          );
                        }}
                      >
                        <label>
                          <span>
                            {t(
                              "Depozit simulat, EUR",
                              "Simulated deposit, EUR",
                            )}
                          </span>
                          <input
                            name="deposit"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue="250"
                            required
                          />
                        </label>
                        <button
                          className="button secondary"
                          disabled={
                            mutation.busy ||
                            new Date(
                              str(auctionForBid(bid) || {}, "ends_at"),
                            ).getTime() > now
                          }
                        >
                          {t("Selectează oferta", "Select offer")}
                          <ArrowRight size={14} />
                        </button>
                      </form>
                    </div>
                  ))}
                {!data.bids.some((bid) => {
                  const auction = auctionForBid(bid);
                  return (
                    auction &&
                    data.listings.some(
                      (listing) => listing.id === auction.listing_id,
                    )
                  );
                }) && (
                  <p className="empty-inline">
                    {t(
                      "Ofertele primite vor apărea aici.",
                      "Received offers will appear here.",
                    )}
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "buyer" && (
            <>
              <nav
                className="workspace-subnav"
                aria-label={t("Activitatea mea", "My activity")}
              >
                <button
                  className={section === "activity" ? "active" : ""}
                  onClick={() => setSection("activity")}
                >
                  <KeyRound size={16} />
                  {t("Oferte și rezervări", "Offers & reservations")}
                </button>
                <button
                  className={section === "favorites" ? "active" : ""}
                  onClick={() => setSection("favorites")}
                >
                  <Heart size={16} />
                  {t("Favorite", "Favorites")} ({data.favorites.length})
                </button>
                <button
                  className={section === "messages" ? "active" : ""}
                  onClick={() => setSection("messages")}
                >
                  <MessageCircle size={16} />
                  {t("Mesaje", "Messages")}
                </button>
              </nav>
              {section === "favorites" &&
                (data.favorites.length ? (
                  <div className="property-grid">
                    {catalogue
                      .filter((item) => data.favorites.includes(item.id))
                      .map((item) => (
                        <PropertyCard key={item.id} listing={item} />
                      ))}
                  </div>
                ) : (
                  <Empty
                    icon={<Heart />}
                    title={t(
                      "Aici păstrezi posibilitățile.",
                      "Keep your possibilities here.",
                    )}
                    text={t(
                      "Apasă inima de pe un anunț pentru a-l găsi ușor mai târziu.",
                      "Tap the heart on a home to find it easily later.",
                    )}
                    link
                  />
                ))}
              {section === "activity" && (
                <section className="workspace-section">
                  <h2>{t("Ofertele mele", "My offers")}</h2>
                  {data.bids.filter((bid) => bid.bidder_id === viewer.id)
                    .length ? (
                    data.bids
                      .filter((bid) => bid.bidder_id === viewer.id)
                      .map((bid) => (
                        <div className="activity-row" key={str(bid, "id")}>
                          <span className="round-icon">
                            <KeyRound size={20} />
                          </span>
                          <div>
                            <h3>
                              {listingName(
                                str(auctionForBid(bid) || {}, "listing_id"),
                              )}
                            </h3>
                            <p>
                              {dateTime(str(bid, "created_at"), language)} ·{" "}
                              {t("Oferta ta", "Your offer")}
                            </p>
                          </div>
                          <strong>
                            {money(num(bid, "amount_minor"), language)}
                          </strong>
                        </div>
                      ))
                  ) : (
                    <Empty
                      icon={<KeyRound />}
                      title={t(
                        "Următorul pas te așteaptă.",
                        "Your next step is waiting.",
                      )}
                      text={t(
                        "Ofertele tale publice și confidențiale vor apărea aici.",
                        "Your public and confidential offers will appear here.",
                      )}
                      link
                    />
                  )}
                </section>
              )}
            </>
          )}
          {(tab === "owner" || section === "activity") && (
            <section className="workspace-section">
              <h2>{t("Rezervări simulate", "Simulated reservations")}</h2>
              {data.reservations.length ? (
                data.reservations.map((reservation) => {
                  const ownerId = str(reservation, "owner_id");
                  const isOwner = ownerId === viewer.id;
                  const status = str(reservation, "status");
                  const terminal = [
                    "signed",
                    "cancelled",
                    "expired",
                    "refunded",
                    "completed",
                  ].includes(status);
                  const funded = [
                    "funded",
                    "partially_signed",
                    "buyer_signed",
                    "owner_signed",
                  ].includes(status);
                  return (
                    <article
                      className="reservation-card"
                      key={str(reservation, "id")}
                    >
                      <div className="reservation-heading">
                        <div>
                          <span className="eyebrow">
                            {t("REZERVARE", "RESERVATION")}{" "}
                            {short(str(reservation, "id"))}
                          </span>
                          <h3>
                            {money(num(reservation, "deposit_minor"), language)}{" "}
                            <small>
                              {t("depozit simulat", "simulated deposit")}
                            </small>
                          </h3>
                        </div>
                        <span className="badge badge-navy">
                          {statusLabel(status, t)}
                        </span>
                      </div>
                      <p className="muted small">
                        {str(reservation, "expires_at") &&
                          `${t("Expiră:", "Expires:")} ${dateTime(str(reservation, "expires_at"), language)}`}
                      </p>
                      {funded && (
                        <p className="small">
                          {t(
                            "Semnarea este confirmată separat de fiecare parte. Contractul este marcat semnat doar după ambele confirmări.",
                            "Each party confirms signing separately. The contract is marked signed only after both confirmations.",
                          )}
                        </p>
                      )}
                      {!terminal && (
                        <div className="reservation-actions">
                          {!isOwner && !funded && (
                            <button
                              className="button primary"
                              disabled={mutation.busy}
                              onClick={() =>
                                void act("advance_reservation", {
                                  p_reservation_id: reservation.id,
                                  p_action: "fund",
                                })
                              }
                            >
                              {t("Simulează finanțarea", "Simulate funding")}
                              <ArrowRight size={15} />
                            </button>
                          )}
                          {funded && (
                            <button
                              className="button primary"
                              disabled={
                                mutation.busy ||
                                Boolean(
                                  reservation[
                                    isOwner
                                      ? "owner_signed_at"
                                      : "buyer_signed_at"
                                  ],
                                )
                              }
                              onClick={() =>
                                void act("advance_reservation", {
                                  p_reservation_id: reservation.id,
                                  p_action: "sign",
                                })
                              }
                            >
                              <Check size={16} />
                              {reservation[
                                isOwner ? "owner_signed_at" : "buyer_signed_at"
                              ]
                                ? t(
                                    "Confirmat · așteaptă cealaltă parte",
                                    "Confirmed · awaiting other party",
                                  )
                                : t(
                                    "Confirm că am semnat",
                                    "Confirm I have signed",
                                  )}
                            </button>
                          )}
                          <button
                            className="button secondary"
                            disabled={mutation.busy}
                            onClick={() =>
                              void act(
                                "advance_reservation",
                                {
                                  p_reservation_id: reservation.id,
                                  p_action: "cancel",
                                },
                                t(
                                  "Rezervare anulată. Depozitul simulat este rambursat integral.",
                                  "Reservation cancelled. The simulated deposit is fully refunded.",
                                ),
                              )
                            }
                          >
                            {t(
                              "Anulează și rambursează simularea",
                              "Cancel & refund simulation",
                            )}
                          </button>
                        </div>
                      )}
                      {status === "signed" && (
                        <p className="feedback success">
                          <Check size={16} />
                          {t(
                            "Ambele părți au confirmat semnarea.",
                            "Both parties have confirmed signing.",
                          )}
                        </p>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="empty-inline">
                  {t(
                    "Nu ai rezervări active. Proprietarul poate iniția una după închiderea licitației.",
                    "No reservations yet. The owner may request one after an auction closes.",
                  )}
                </p>
              )}
            </section>
          )}
          {(tab === "owner" || section === "activity") && (
            <section className="workspace-section">
              <h2>{t("Vizionări", "Viewings")}</h2>
              {data.viewings.length ? (
                data.viewings.map((viewing) => (
                  <div className="viewing-row" key={str(viewing, "id")}>
                    <CalendarDays size={21} />
                    <div>
                      <h3>{listingName(str(viewing, "listing_id"))}</h3>
                      <strong>
                        {dateTime(str(viewing, "requested_at"), language)}
                      </strong>
                      <p>{str(viewing, "message")}</p>
                      <span className="small muted">
                        {statusLabel(str(viewing, "status"), t)}
                      </span>
                    </div>
                    {!["cancelled", "completed"].includes(
                      str(viewing, "status"),
                    ) && (
                      <div className="row-actions">
                        {(str(viewing, "owner_id") === viewer.id ||
                          data.listings.some(
                            (listing) => listing.id === viewing.listing_id,
                          )) &&
                          str(viewing, "status") !== "confirmed" && (
                            <button
                              className="button secondary"
                              disabled={mutation.busy}
                              onClick={() =>
                                void act("update_viewing", {
                                  p_viewing_id: viewing.id,
                                  p_status: "confirmed",
                                })
                              }
                            >
                              {t("Confirmă", "Confirm")}
                            </button>
                          )}
                        <button
                          className="text-button"
                          disabled={mutation.busy}
                          onClick={() =>
                            void act("update_viewing", {
                              p_viewing_id: viewing.id,
                              p_status: "cancelled",
                            })
                          }
                        >
                          {t("Anulează", "Cancel")}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="empty-inline">
                  {t(
                    "Cererile și confirmările de vizionare vor apărea aici.",
                    "Viewing requests and confirmations will appear here.",
                  )}
                </p>
              )}
            </section>
          )}
          {(tab === "owner" || section === "messages") && (
            <section className="workspace-section">
              <h2>{t("Conversații", "Conversations")}</h2>
              {data.conversations.length ? (
                <div className="messaging">
                  <div className="conversation-list">
                    {data.conversations.map((item) => (
                      <button
                        key={str(item, "id")}
                        className={
                          item.id === selectedConversation?.id ? "active" : ""
                        }
                        onClick={() => setConversation(str(item, "id"))}
                      >
                        <MessageCircle size={18} />
                        <span>
                          {listingName(str(item, "listing_id"))}
                          <small>{short(str(item, "id"))}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="conversation-thread">
                    <div className="thread-heading">
                      {listingName(str(selectedConversation, "listing_id"))}
                    </div>
                    <div className="message-list">
                      {data.messages
                        .filter(
                          (item) =>
                            item.conversation_id === selectedConversation.id,
                        )
                        .map((item) => (
                          <div
                            className={`message-bubble ${item.sender_id === viewer.id ? "mine" : ""}`}
                            key={str(item, "id")}
                          >
                            <p>{str(item, "body")}</p>
                            <time>
                              {dateTime(str(item, "created_at"), language)}
                            </time>
                          </div>
                        ))}
                    </div>
                    <form
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const element = event.currentTarget;
                        const form = new FormData(element);
                        if (
                          await mutation.mutate(
                            "send_message",
                            {
                              p_listing_id: selectedConversation.listing_id,
                              p_conversation_id: selectedConversation.id,
                              p_body: form.get("body"),
                            },
                            t("Mesaj trimis.", "Message sent."),
                          )
                        ) {
                          element.reset();
                          await load();
                        }
                      }}
                    >
                      <label className="sr-only" htmlFor="reply">
                        {t("Răspunde", "Reply")}
                      </label>
                      <textarea
                        id="reply"
                        name="body"
                        rows={2}
                        minLength={2}
                        maxLength={3000}
                        required
                        placeholder={t("Scrie un mesaj…", "Write a message…")}
                      />
                      <button
                        className="button primary"
                        disabled={mutation.busy}
                        aria-label={t("Trimite mesajul", "Send message")}
                      >
                        <ArrowUpRight size={19} />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <Empty
                  icon={<Inbox />}
                  title={t(
                    "O conversație poate schimba totul.",
                    "A conversation can change everything.",
                  )}
                  text={t(
                    "Trimite un mesaj din pagina unei locuințe. Îl vei regăsi aici.",
                    "Send a message from a property page. You’ll find it here.",
                  )}
                  link
                />
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
function Empty({
  icon,
  title,
  text,
  link = false,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  link?: boolean;
}) {
  const { t } = usePlatform();
  return (
    <div className="workspace-empty">
      <span className="round-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {link && (
        <Link className="text-link" href="/">
          {t("Descoperă locuințe", "Explore homes")}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
function statusLabel(status: string, t: (ro: string, en: string) => string) {
  const labels: Record<string, [string, string]> = {
    active: ["Activă", "Active"],
    published: ["Publicat", "Published"],
    open: ["Deschisă", "Open"],
    scheduled: ["Programată", "Scheduled"],
    closed: ["Închisă", "Closed"],
    ended: ["Încheiată", "Ended"],
    requested: ["Solicitată", "Requested"],
    pending: ["În așteptare", "Pending"],
    funded: ["Finanțată (simulare)", "Funded (simulation)"],
    signed: ["Semnată de ambele părți", "Signed by both parties"],
    cancelled: ["Anulată", "Cancelled"],
    expired: ["Expirată", "Expired"],
    refunded: ["Rambursată (simulare)", "Refunded (simulation)"],
    confirmed: ["Confirmată", "Confirmed"],
    completed: ["Finalizată", "Completed"],
    reserved: ["Rezervată", "Reserved"],
    rented: ["Închiriată", "Rented"],
    sold: ["Vândută", "Sold"],
  };
  const label = labels[status];
  return label ? t(...label) : status;
}
function PropertyEditor({
  onSaved,
  property,
  listings,
}: {
  onSaved: () => Promise<void>;
  property: Row | null;
  listings: Row[];
}) {
  const { t } = usePlatform();
  const mutation = useMutation();
  const [savedPropertyId, setSavedPropertyId] = useState<string | null>(
    property ? str(property, "id") : null,
  );
  const [images, setImages] = useState(
    Array.isArray(property?.image_urls) ? property.image_urls.join("\n") : "",
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    if (file.size > 3000000) {
      setUploadError(
        t(
          "Alege o imagine mai mică de 3 MB.",
          "Choose an image smaller than 3 MB.",
        ),
      );
      return;
    }
    if (images.split("\n").filter(Boolean).length >= 12) {
      setUploadError(
        t(
          "Poți adăuga cel mult 12 fotografii.",
          "You can add up to 12 photos.",
        ),
      );
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/media", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok || body.error)
        throw new Error(
          body.error ||
            t(
              "Fotografia nu a putut fi încărcată.",
              "The photo could not be uploaded.",
            ),
        );
      setImages((previous) =>
        [previous, body.data.url].filter(Boolean).join("\n"),
      );
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : t("Încărcarea a eșuat.", "Upload failed."),
      );
    } finally {
      setUploading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sale = Number(form.get("sale")),
      rent = Number(form.get("rent"));
    const payload = {
      p_title: form.get("title"),
      p_description: form.get("description"),
      p_neighborhood: form.get("neighborhood"),
      p_exact_address: form.get("address"),
      p_property_type: form.get("type"),
      p_area_sqm: Number(form.get("area")),
      p_rooms: Number(form.get("rooms")),
      p_floor: Number(form.get("floor")),
      p_built_year: Number(form.get("year")),
      p_sale_price_minor: sale > 0 ? Math.round(sale * 100) : null,
      p_rent_price_minor: rent > 0 ? Math.round(rent * 100) : null,
      p_image_urls: String(form.get("images"))
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean),
    };
    const saved = await mutation.mutate(
      savedPropertyId ? "update_property" : "create_property",
      {
        ...payload,
        ...(savedPropertyId ? { p_property_id: savedPropertyId } : {}),
      },
      t(
        "Proprietatea și anunțurile asociate au fost salvate.",
        "Property and linked listings saved.",
      ),
    );
    if (saved) {
      const id = savedPropertyId || String((saved.data as Row)?.id || "");
      if (id) setSavedPropertyId(id);
      const tour = String(form.get("tour_url") || "").trim();
      if (id && tour !== String(property?.tour_url || "")) {
        if (
          !(await mutation.mutate(
            "set_property_tour",
            { p_property_id: id, p_tour_url: tour || null },
            t("Turul virtual a fost salvat.", "Virtual tour saved."),
          ))
        )
          return;
      }
      await onSaved();
    }
  }
  return (
    <form className="editor-panel" onSubmit={submit}>
      <div className="editor-heading">
        <span className="eyebrow">
          {t("DETALII CARE CONTEAZĂ", "DETAILS THAT MATTER")}
        </span>
        <h3>
          {property
            ? t("Editează proprietatea", "Edit property")
            : t("O nouă proprietate", "A new property")}
        </h3>
      </div>
      <div className="form-grid">
        <label className="span-2">
          {t("Titlul anunțului", "Listing title")}
          <input
            name="title"
            defaultValue={property ? str(property, "title") : undefined}
            required
            minLength={5}
            maxLength={160}
            placeholder={t(
              "Un loc luminos, aproape de parc",
              "A light-filled home by the park",
            )}
          />
        </label>
        <label>
          {t("Cartier", "Neighborhood")}
          <input
            name="neighborhood"
            defaultValue={property ? str(property, "neighborhood") : undefined}
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <label>
          {t("Adresa exactă · privată", "Exact address · private")}
          <input
            name="address"
            defaultValue={property ? str(property, "exact_address") : undefined}
            required
            minLength={5}
            maxLength={300}
          />
        </label>
        <label>
          {t("Tipul proprietății", "Property type")}
          <select
            name="type"
            defaultValue={
              property ? str(property, "property_type") : "apartment"
            }
          >
            <option value="apartment">{t("Apartament", "Apartment")}</option>
            <option value="house">{t("Casă", "House")}</option>
          </select>
        </label>
        <label>
          {t("Suprafață utilă, m²", "Usable area, m²")}
          <input
            name="area"
            defaultValue={property ? str(property, "area_sqm") : undefined}
            type="number"
            min="5"
            max="10000"
            required
          />
        </label>
        <label>
          {t("Camere", "Rooms")}
          <input
            name="rooms"
            defaultValue={property ? str(property, "rooms") : undefined}
            type="number"
            min="1"
            max="100"
            required
          />
        </label>
        <label>
          {t("Etaj (0 = parter)", "Floor (0 = ground)")}
          <input
            name="floor"
            type="number"
            min="-3"
            max="100"
            defaultValue={property ? str(property, "floor") : "0"}
            required
          />
        </label>
        <label>
          {t("Anul construcției", "Year built")}
          <input
            name="year"
            defaultValue={property ? str(property, "built_year") : undefined}
            type="number"
            min="1800"
            max={new Date().getFullYear() + 3}
            required
          />
        </label>
        <div className="form-helper">
          <LockKeyhole size={17} />
          {t(
            "Adresa exactă nu este publicată în catalog.",
            "Your exact address is never published in the catalogue.",
          )}
        </div>
        <label className="span-2">
          {t("Descriere", "Description")}
          <textarea
            name="description"
            defaultValue={property ? str(property, "description") : undefined}
            rows={4}
            minLength={20}
            maxLength={5000}
            required
          />
        </label>
      </div>
      <div className="dual-price-box">
        <div>
          <h4>
            {t(
              "O proprietate. Două posibilități.",
              "One property. Two possibilities.",
            )}
          </h4>
          <p>
            {t(
              "Completează cel puțin un preț. Ambele creează anunțuri legate de aceeași proprietate.",
              "Enter at least one price. Entering both creates two listings linked to the same property.",
            )}
          </p>
        </div>
        <label>
          {t("Preț total de vânzare, EUR", "Total sale price, EUR")}
          <input
            name="sale"
            defaultValue={
              property
                ? (Number(
                    listings.find(
                      (item) =>
                        item.property_id === property.id &&
                        item.transaction_type === "sale",
                    )?.price_minor,
                  ) || 0) / 100 || undefined
                : undefined
            }
            type="number"
            min="0.01"
            step="0.01"
            placeholder="249000"
          />
        </label>
        <label>
          {t("Chirie lunară, EUR", "Monthly rent, EUR")}
          <input
            name="rent"
            defaultValue={
              property
                ? (Number(
                    listings.find(
                      (item) =>
                        item.property_id === property.id &&
                        item.transaction_type === "rent",
                    )?.price_minor,
                  ) || 0) / 100 || undefined
                : undefined
            }
            type="number"
            min="0.01"
            step="0.01"
            placeholder="1100"
          />
        </label>
      </div>
      <label className="block-label">
        {t(
          "Fotografii · un URL HTTPS pe linie",
          "Photos · one HTTPS URL per line",
        )}
        <textarea
          name="images"
          value={images}
          onChange={(event) => setImages(event.target.value)}
          rows={3}
          placeholder="https://images.unsplash.com/photo-…"
        />
        <small className="muted">
          {t(
            "URL-uri de pe gazdele aprobate sau fotografii JPG, PNG și WebP, maximum 3 MB fiecare, cel mult 12 fotografii.",
            "Approved image URLs or JPG, PNG and WebP photos, maximum 3 MB each, up to 12 photos.",
          )}
        </small>
      </label>
      <label className="block-label">
        {t(
          "Tur 360° · link opțional Kuula sau Matterport",
          "360° tour · optional Kuula or Matterport share link",
        )}
        <input
          name="tour_url"
          type="url"
          defaultValue={property ? str(property, "tour_url") : undefined}
          placeholder="https://kuula.co/share/…"
        />
        <small className="muted">
          {t(
            "Doar linkuri https://kuula.co/share/ sau https://my.matterport.com/show/?m= . Lasă gol dacă nu ai un tur.",
            "Only https://kuula.co/share/ or https://my.matterport.com/show/?m= links. Leave empty if no tour is available.",
          )}
        </small>
      </label>
      <label className="upload-control">
        <Plus size={17} />
        {uploading
          ? t("Se încarcă fotografia…", "Uploading photo…")
          : t("Încarcă o fotografie", "Upload a photo")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <Feedback
        error={uploadError || mutation.error}
        message={mutation.message}
      />
      <button className="button primary" disabled={mutation.busy || uploading}>
        {mutation.busy
          ? t("Se salvează…", "Saving…")
          : property
            ? t("Salvează proprietatea", "Save property")
            : t("Publică proprietatea", "Publish property")}
        <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
function AuctionEditor({
  listings,
  onSaved,
}: {
  listings: Row[];
  onSaved: () => Promise<void>;
}) {
  const { t, language } = usePlatform();
  const mutation = useMutation();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState("ascending");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await mutation.mutate(
        "start_auction",
        {
          p_listing_id: form.get("listing"),
          p_mode: form.get("mode"),
          p_access: form.get("access"),
          p_starts_at: new Date(String(form.get("start"))).toISOString(),
          p_ends_at: new Date(String(form.get("end"))).toISOString(),
          p_starting_price_minor: Math.round(
            Number(form.get("starting")) * 100,
          ),
          p_min_increment_minor: Math.round(
            Number(form.get("increment")) * 100,
          ),
        },
        t("Licitația a fost creată.", "Auction created."),
      )
    )
      await onSaved();
  }
  return (
    <section className="auction-editor">
      <button
        className="disclosure-button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span>
          <Plus size={18} />
          {t("Pornește o licitație", "Start an auction")}
        </span>
        <ChevronDown size={18} className={expanded ? "rotate" : ""} />
      </button>
      {expanded && (
        <form className="editor-panel" onSubmit={submit}>
          <p className="muted">
            {t(
              "O singură licitație activă sau programată per proprietate. O rezervare activă blochează licitațiile noi.",
              "Only one active or scheduled auction per property. An active reservation blocks new auctions.",
            )}
          </p>
          <div className="form-grid">
            <label className="span-2">
              {t("Anunț", "Listing")}
              <select name="listing" required>
                {listings.map((item) => (
                  <option key={str(item, "id")} value={str(item, "id")}>
                    {str(item, "title") || short(str(item, "property_id"))} ·{" "}
                    {str(item, "transaction_type") === "sale"
                      ? t("Vânzare", "Sale")
                      : t("Închiriere", "Rent")}{" "}
                    · {money(num(item, "price_minor"), language)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Vizibilitatea ofertelor", "Offer visibility")}
              <select
                name="mode"
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                <option value="ascending">
                  {t(
                    "Ascendentă · oferte publice",
                    "Ascending · public amounts",
                  )}
                </option>
                <option value="sealed">
                  {t(
                    "Confidențială · oferte sigilate",
                    "Sealed · confidential amounts",
                  )}
                </option>
              </select>
            </label>
            <label>
              {t("Accesul participanților", "Participant access")}
              <select name="access">
                <option value="public">
                  {t(
                    "Public · conturi verificate",
                    "Public · verified accounts",
                  )}
                </option>
                <option value="invite">
                  {t("Doar cu invitație", "Invitation only")}
                </option>
              </select>
            </label>
            <label>
              {t("Începe la", "Starts at")}
              <input name="start" type="datetime-local" required />
            </label>
            <label>
              {t("Se încheie la", "Ends at")}
              <input name="end" type="datetime-local" required />
            </label>
            <label>
              {t("Preț de pornire, EUR", "Starting price, EUR")}
              <input
                name="starting"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label>
              {t("Pas minim, EUR", "Minimum increment, EUR")}
              <input
                name="increment"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue="100"
                required
              />
              <small className="muted">
                {mode === "sealed"
                  ? t(
                      "Ofertele sigilate rămân confidențiale.",
                      "Sealed offers remain confidential.",
                    )
                  : t(
                      "Fiecare ofertă trebuie să respecte pasul minim.",
                      "Each new offer must meet this increment.",
                    )}
              </small>
            </label>
          </div>
          <Feedback error={mutation.error} message={mutation.message} />
          <button className="button primary" disabled={mutation.busy}>
            {mutation.busy
              ? t("Se creează…", "Creating…")
              : t("Creează licitația", "Create auction")}
            <ArrowUpRight size={16} />
          </button>
        </form>
      )}
    </section>
  );
}
