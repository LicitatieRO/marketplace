import type { TourStepDefinition } from "./types";

/** Full step catalogue for future UX spec; only placeholders are active for now. */
export const TOUR_STEP_CATALOGUE: TourStepDefinition[] = [
  {
    id: "catalogue-hero",
    selector: '[data-tour="catalogue-hero"]',
    route: "/",
    titleRo: "Bine ai venit",
    titleEn: "Welcome",
    bodyRo:
      "Tur rapid prin catalogul demonstrativ — locuințe din București, oferte simulate.",
    bodyEn:
      "A quick walkthrough of the demo catalogue — Bucharest homes and simulated offers.",
    placement: "bottom",
  },
  {
    id: "catalogue-search",
    selector: '[data-tour="catalogue-search"]',
    route: "/",
    titleRo: "Caută și filtrează",
    titleEn: "Search and filter",
    bodyRo:
      "Alege vânzare sau închiriere, bugetul și cartierul — rezultatele se actualizează imediat.",
    bodyEn:
      "Pick sale or rent, budget, and neighborhood — results update instantly.",
    placement: "bottom",
  },
  {
    id: "catalogue-map",
    selector: '[data-tour="catalogue-map"]',
    route: "/",
    titleRo: "Harta catalogului",
    titleEn: "Catalogue map",
    bodyRo:
      "Vezi locuințele pe hartă; deschide harta completă pentru licitații pe zone.",
    bodyEn:
      "See homes on the map; open the full map for area-based auctions.",
    placement: "top",
  },
  {
    id: "listing-card",
    selector: '[data-tour="listing-card"]',
    route: "/",
    titleRo: "Anunț exemplu",
    titleEn: "Sample listing",
    bodyRo:
      "Deschide o locuință pentru detalii, licitație și mesaje — totul este simulare (POC).",
    bodyEn:
      "Open a home for details, bidding, and messages — everything is a POC simulation.",
    placement: "top",
  },
  {
    id: "poc-simulation",
    selector: '[data-tour="poc-simulation"]',
    titleRo: "Simulare POC",
    titleEn: "POC simulation",
    bodyRo:
      "Fără bani reali, fără escrow — bannerul reamintește că este doar demonstrație.",
    bodyEn:
      "No real money, no escrow — this banner reminds you it is demo-only.",
    placement: "bottom",
  },
  {
    id: "account-signin",
    selector: '[data-tour="account-signin"]',
    titleRo: "Contul tău",
    titleEn: "Your account",
    bodyRo: "Autentifică-te pentru oferte, favorite și spațiul de lucru.",
    bodyEn: "Sign in for bids, favorites, and your workspace.",
    placement: "bottom",
  },
  {
    id: "listing-price",
    selector: '[data-tour="listing-price"]',
    route: "/listings/20000000-0000-4000-8000-000000000001",
    titleRo: "Preț afișat",
    titleEn: "Asking price",
    bodyRo: "Prețul de referință al anunțului — licitația poate avea reguli separate.",
    bodyEn: "The listing reference price — the auction may have separate rules.",
    placement: "bottom",
  },
  {
    id: "listing-bid-panel",
    selector: '[data-tour="listing-bid-panel"]',
    route: "/listings/20000000-0000-4000-8000-000000000001",
    titleRo: "Panou oferte",
    titleEn: "Offer panel",
    bodyRo:
      "Starea licitației, numărătoarea inversă și regulile sunt vizibile înainte să participi.",
    bodyEn:
      "Auction state, countdown, and rules are visible before you participate.",
    placement: "left",
  },
  {
    id: "listing-bid-button",
    selector: '[data-tour="listing-bid-button"]',
    route: "/listings/20000000-0000-4000-8000-000000000001",
    titleRo: "Trimite oferta",
    titleEn: "Submit an offer",
    bodyRo: "După autentificare, oferta este înregistrată ca simulare — fără obligații legale.",
    bodyEn:
      "After sign-in, your offer is recorded as a simulation — no legal obligation.",
    placement: "top",
  },
];

/** Investor-demo placeholder flow (home page only). */
export const ACTIVE_TOUR_STEPS: TourStepDefinition[] = TOUR_STEP_CATALOGUE.filter(
  (step) =>
    step.id === "catalogue-hero" ||
    step.id === "catalogue-search" ||
    step.id === "catalogue-map" ||
    step.id === "listing-card",
);