import type { AuctionMode, Language } from "./types";
import { translate } from "./i18n";

/** Shared RO/EN glossary for bidding (P1-7). */
export function bidGlossary(language: Language) {
  return {
    placeBid: translate(language, "Licitează", "Place bid"),
    confirmBid: translate(
      language,
      "Confirmă oferta simulată",
      "Confirm simulated bid",
    ),
    cancel: translate(language, "Anulează", "Cancel"),
    signInToBid: translate(
      language,
      "Intră în cont ca să licitezi",
      "Sign in to bid",
    ),
    bidAmountLabel: translate(language, "Sumă ofertă (EUR)", "Bid amount (EUR)"),
    yourOfferEur: translate(language, "Oferta ta în EUR", "Your offer in EUR"),
    currentOffer: translate(language, "Ofertă curentă", "Current bid"),
    offersRecorded: (count: number) =>
      translate(
        language,
        `${count} ${count === 1 ? "ofertă" : "oferte"}`,
        `${count} ${count === 1 ? "bid" : "bids"}`,
      ),
    bidRecordedSimulation: translate(
      language,
      "Oferta (simulare) a fost înregistrată.",
      "Your bid (simulation) has been recorded.",
    ),
    minimumIncrement: translate(language, "Pas minim:", "Minimum increment:"),
  };
}

export function legalAuctionBadge(mode: AuctionMode, language: Language) {
  return mode === "sealed"
    ? translate(
        language,
        "OFERTE CONFIDENȚIALE (POC)",
        "CONFIDENTIAL OFFERS (POC)",
      )
    : translate(
        language,
        "LICITAȚIE SIMULATĂ (POC)",
        "SIMULATED AUCTION (POC)",
      );
}

export function legalCatalogueAuctionBadge(
  mode: AuctionMode,
  language: Language,
) {
  return mode === "sealed"
    ? translate(
        language,
        "Ofertă confidențială (POC)",
        "Confidential offer (POC)",
      )
    : translate(
        language,
        "Licitație simulată (POC)",
        "Simulated auction (POC)",
      );
}

export function legalOfferFineprint(language: Language) {
  return translate(
    language,
    "Oferte simulate, neangajante; nu se percep garanții. Nu este o licitație publică sau o executare silită și nu transferă proprietatea. Proprietarul poate selecta o ofertă după închidere. Invitația și validarea contului sunt necesare unde se aplică. Ora și eligibilitatea sunt verificate de server.",
    "Simulated, non-binding offers; no bid bonds or deposits are taken. This is not a public or enforcement auction and does not transfer title. The owner may select an offer after closing. An invitation and verified account are required where applicable. The server verifies timing and eligibility.",
  );
}

export function legalSimulationScopeNote(language: Language) {
  return translate(
    language,
    "Licitațiile, ofertele și rezervările sunt doar simulate. Fără plăți, garanții, portofel sau transfer de bani reali.",
    "Auctions, offers and reservations are simulation only. No payments, bid bonds, wallet, or real money transfers.",
  );
}

export function bidConfirmPrompt(
  language: Language,
  amountFormatted: string,
  minIncrementFormatted: string,
) {
  return translate(
    language,
    `Confirmi oferta simulată (POC) de ${amountFormatted}? Pas minim: ${minIncrementFormatted}. Oferta este neangajantă: nu se percep plăți sau garanții, nu se transferă bani și nu se încheie un contract.`,
    `Confirm your simulated (POC) ${amountFormatted} bid? Minimum step: ${minIncrementFormatted}. This offer is non-binding: no payment or deposit is taken, no money moves, and no contract is formed.`,
  );
}

export function legalConfirmSimulatedSigning(language: Language) {
  return translate(
    language,
    "Confirm semnarea simulată — nu este arvună și nu transferă proprietatea",
    "Confirm simulated signing — not earnest money and does not transfer title",
  );
}

/** Workspace / reservation status labels with simulation qualifiers (#55). */
export function workspaceStatusLabelPairs(): Record<string, [string, string]> {
  return {
    active: ["Activă", "Active"],
    published: ["Publicat", "Published"],
    open: ["Deschisă", "Open"],
    scheduled: ["Programată", "Scheduled"],
    closed: ["Închisă", "Closed"],
    ended: ["Încheiată", "Ended"],
    requested: ["Solicitată", "Requested"],
    pending: ["În așteptare", "Pending"],
    funded: ["Finanțată (simulare)", "Funded (simulation)"],
    signed: [
      "Semnare simulată (ambele părți)",
      "Simulated signing (both parties)",
    ],
    cancelled: ["Anulată", "Cancelled"],
    expired: ["Expirată", "Expired"],
    refunded: ["Rambursată (simulare)", "Refunded (simulation)"],
    confirmed: ["Confirmată", "Confirmed"],
    completed: ["Finalizată (simulare)", "Completed (simulation)"],
    reserved: ["Rezervare simulată", "Simulated reservation"],
    rented: ["Marcată închiriată (simulare)", "Marked rented (simulation)"],
    sold: ["Marcată vândută (simulare)", "Marked sold (simulation)"],
  };
}

export function workspaceStatusLabel(
  status: string,
  language: Language,
): string {
  const pair = workspaceStatusLabelPairs()[status];
  return pair ? translate(language, ...pair) : status;
}

export function legalMapPageTitle(language: Language) {
  return translate(
    language,
    "Hartă licitații simulate (POC)",
    "Simulated auction map (POC)",
  );
}

export function legalMapScheduledAuctionFallback(language: Language) {
  return translate(
    language,
    "Licitație simulată programată",
    "Scheduled simulated auction",
  );
}

export function legalSimulatedAuctionCreatedToast(language: Language) {
  return translate(
    language,
    "Licitația simulată a fost creată.",
    "Simulated auction created.",
  );
}

export type BidConfirmStep = "edit" | "confirm";

export function advanceBidConfirmStep(
  step: BidConfirmStep,
  action: "open_confirm" | "cancel" | "submit",
): BidConfirmStep {
  if (action === "open_confirm") return "confirm";
  if (action === "cancel") return "edit";
  return "edit";
}
