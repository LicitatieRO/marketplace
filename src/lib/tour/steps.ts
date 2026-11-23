import {
  TOUR_DEMO_LISTING_ID,
  TOUR_LISTING_ROUTE,
  TOUR_MAP_LISTING_ROUTE,
} from "./constants";
import type { TourKind, TourStepDefinition } from "./types";

export const BUYER_TOUR_STEPS: TourStepDefinition[] = [
  {
    id: "B1",
    tour: "buyer",
    route: "/",
    target: "hero",
    titleRo: "Bun venit la LicitatieRO",
    titleEn: "Welcome to LicitatieRO",
    bodyRo:
      "Locuințe din București, la licitație transparentă. Îți arătăm în 1 minut cum funcționează.",
    bodyEn:
      "Bucharest homes, sold by transparent auction. A one-minute look at how it works.",
    placement: "bottom",
    desktopPlacement: "center",
    mobilePlacement: "sheet",
    action: "optional",
  },
  {
    id: "B2",
    tour: "buyer",
    route: "/",
    target: "poc-banner",
    titleRo: "Totul e simulare",
    titleEn: "Everything is simulated",
    bodyRo:
      "Ofertele, rezervările și plățile sunt POC / Simulare. Nu se mișcă bani reali și nu există escrow.",
    bodyEn:
      "Bids, reservations and payments are POC / Simulation. No real money moves and there is no escrow.",
    placement: "bottom",
    mobilePlacement: "sheet",
    action: "optional",
  },
  {
    id: "B3",
    tour: "buyer",
    route: "/",
    target: "catalogue-search",
    titleRo: "Caută în ritmul tău",
    titleEn: "Search your way",
    bodyRo:
      "Alege Cumpără sau Închiriază, cartierul și bugetul. Filtrele te urmează și pe hartă.",
    bodyEn:
      "Pick Buy or Rent, a neighbourhood and a budget. Your filters carry over to the map.",
    placement: "bottom",
    mobilePlacement: "sheet",
    action: "optional",
  },
  {
    id: "B4",
    tour: "buyer",
    route: "/",
    target: "listing-card",
    titleRo: "Un anunț, dintr-o privire",
    titleEn: "A listing at a glance",
    bodyRo:
      "Foto, cartier, preț și tipul licitației: deschisă sau confidențială. Salvează cu inimioara.",
    bodyEn:
      "Photo, area, price and auction type: open or confidential. Tap the heart to save it.",
    placement: "right",
    desktopPlacement: "right",
    mobilePlacement: "sheet",
    action: "optional",
  },
  {
    id: "B5",
    tour: "buyer",
    route: "/",
    target: "nav-map",
    fallbackTargets: ['[data-testid="nav-map-link-mobile"]'],
    titleRo: "Vezi totul pe hartă",
    titleEn: "See it all on a map",
    bodyRo:
      "Deschide harta: listă și hartă una lângă alta pe desktop, comutator pe telefon.",
    bodyEn:
      "Open the map: list and map side by side on desktop, a toggle on your phone.",
    placement: "bottom",
    mobilePlacement: "sheet",
    action: "required",
    advanceRoute: "/map",
  },
  {
    id: "B6",
    tour: "buyer",
    route: "/map",
    target: "map-surface",
    fallbackTargets: [
      "map-consent-accept",
      '[data-testid="listings-map-mobile-toggle"]',
    ],
    titleRo: "Prețuri pe hartă",
    titleEn: "Prices on the map",
    bodyRo:
      "Pastilele arată oferta curentă. Pinul e aproximativ: adresa exactă nu e publică.",
    bodyEn:
      "Pills show the current bid. Pins are approximate, and the exact address is never public.",
    bodyRoNoConsent:
      "Harta OSM se încarcă doar dacă accepți. Lista merge oricum.",
    bodyEnNoConsent:
      "The OSM map loads only if you accept. The list works either way.",
    placement: "left",
    mobilePlacement: "sheet",
    action: "optional",
  },
  {
    id: "B7",
    tour: "buyer",
    route: TOUR_MAP_LISTING_ROUTE,
    target: "map-card-bid",
    fallbackTargets: [
      '[data-testid="map-guest-bid-login"]',
      '[data-testid="map-card-scheduled-copy"]',
    ],
    titleRo: "Licitează în siguranță",
    titleEn: "Bid safely",
    bodyRo:
      "Vezi pasul minim și timpul rămas. Orice ofertă cere o confirmare; nimic nu se trimite singur.",
    bodyEn:
      "See the minimum step and time left. Every bid asks you to confirm, and nothing is sent automatically.",
    placement: "left",
    mobilePlacement: "sheet",
    action: "optional",
  },
  {
    id: "B8",
    tour: "buyer",
    route: TOUR_LISTING_ROUTE,
    target: "offer-panel",
    titleRo: "Regulile, la vedere",
    titleEn: "Rules in plain sight",
    bodyRo:
      "Cronometrul și regula anti-sniping sunt decise de server. Proprietarul alege oferta după închidere.",
    bodyEn:
      "The countdown and anti-sniping rule are server-enforced. The owner picks an offer after closing.",
    placement: "left",
    mobilePlacement: "sheet",
    action: "optional",
  },
  {
    id: "B9",
    tour: "buyer",
    route: TOUR_LISTING_ROUTE,
    target: "account-entry",
    titleRo: "Gata să participi?",
    titleEn: "Ready to take part?",
    bodyRo:
      "Creează un cont demo; te întoarcem exact la anunțul ăsta. Vrei și partea de proprietar?",
    bodyEn:
      "Create a demo account and we'll bring you back to this listing. Want to see the owner side too?",
    placement: "bottom",
    mobilePlacement: "sheet",
    action: "optional",
    handoffOwnerTour: true,
  },
];

export const OWNER_TOUR_STEPS: TourStepDefinition[] = [
  {
    id: "O1",
    tour: "owner",
    target: "persona-switcher",
    fallbackTargets: ["account-entry"],
    titleRo: "Intră ca proprietar",
    titleEn: "Switch to owner",
    bodyRo:
      "În demo, apasă Proprietar ca să vezi consola. Instrument doar pentru staging.",
    bodyEn:
      "In the demo, tap Owner to open the console. This tool exists on staging only.",
    placement: "bottom",
    mobilePlacement: "sheet",
    action: "required",
    requiresOwnerSession: false,
  },
  {
    id: "O2",
    tour: "owner",
    route: "/workspace?tab=owner",
    target: "workspace-owner-tab",
    titleRo: "Consola proprietarului",
    titleEn: "Owner console",
    bodyRo:
      "Proprietăți, licitații, oferte și mesaje, totul într-un loc.",
    bodyEn:
      "Properties, auctions, offers and messages, all in one place.",
    placement: "bottom",
    mobilePlacement: "sheet",
    action: "optional",
    requiresOwnerSession: true,
  },
  {
    id: "O3",
    tour: "owner",
    route: "/workspace?tab=owner",
    target: "owner-add-property",
    titleRo: "Listează în câteva minute",
    titleEn: "List in minutes",
    bodyRo:
      "Adaugă o proprietate o singură dată, apoi pune-o la vânzare, la închiriat sau ambele.",
    bodyEn:
      "Add a property once, then offer it for sale, for rent, or both.",
    placement: "bottom",
    mobilePlacement: "sheet",
    action: "required",
    requiresOwnerSession: true,
  },
  {
    id: "O4",
    tour: "owner",
    route: "/workspace?tab=owner",
    target: "wizard-dual-price",
    fallbackTargets: ['data-tour="owner-add-property"'],
    titleRo: "Vânzare + chirie",
    titleEn: "Sale + rent",
    bodyRo:
      "Completează unul sau ambele prețuri; publicăm două anunțuri legate. Adresa exactă rămâne privată.",
    bodyEn:
      "Fill in one or both prices to publish two linked listings. The exact address stays private.",
    placement: "top",
    mobilePlacement: "sheet",
    action: "optional",
    requiresOwnerSession: true,
  },
  {
    id: "O5",
    tour: "owner",
    route: "/workspace?tab=owner",
    target: "promo-panel",
    titleRo: "Promovare 10 € / 7 zile",
    titleEn: "€10 / 7-day promotion",
    bodyRo:
      "Un preț acoperă ambele anunțuri. În POC rulează doar în mod test: suma reală e 0,00 €.",
    bodyEn:
      "One price covers both listings. In this POC it runs in test mode only, and the real charge is €0.00.",
    placement: "top",
    mobilePlacement: "sheet",
    action: "optional",
    requiresOwnerSession: true,
  },
  {
    id: "O6",
    tour: "owner",
    route: "/workspace?tab=owner",
    target: "owner-offers",
    titleRo: "Tu alegi oferta",
    titleEn: "You pick the offer",
    bodyRo:
      "Compară ofertele, inclusiv cele confidențiale, și alege după închidere. Rezervarea e simulată.",
    bodyEn:
      "Compare offers, including confidential ones, and choose after closing. The reservation is simulated.",
    placement: "top",
    mobilePlacement: "sheet",
    action: "optional",
    requiresOwnerSession: true,
  },
];

export function stepsForTour(tour: TourKind): TourStepDefinition[] {
  return tour === "buyer" ? BUYER_TOUR_STEPS : OWNER_TOUR_STEPS;
}

export { TOUR_DEMO_LISTING_ID };
