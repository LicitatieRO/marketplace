import type { Language } from "./types";
import { translate } from "./i18n";

/** Shared RO/EN glossary for bid confirm flows (#120, aligned with #182). */
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
      "Autentifică-te pentru a licita",
      "Sign in to bid",
    ),
    bidAmountLabel: translate(language, "Sumă ofertă (EUR)", "Bid amount (EUR)"),
    yourOfferEur: translate(language, "Oferta ta în EUR", "Your offer in EUR"),
    bidRecordedSimulation: translate(
      language,
      "Oferta ta (simulare) a fost înregistrată.",
      "Your bid (simulation) has been recorded.",
    ),
    pocSimulare: "POC / Simulare",
    incrementChipsAria: translate(
      language,
      "Pași rapizi pentru suma ofertei",
      "Quick bid amount steps",
    ),
  };
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

export type BidConfirmStep = "edit" | "confirm";

export function advanceBidConfirmStep(
  step: BidConfirmStep,
  action: "open_confirm" | "cancel" | "submit",
): BidConfirmStep {
  if (action === "open_confirm") return "confirm";
  if (action === "cancel") return "edit";
  return "edit";
}