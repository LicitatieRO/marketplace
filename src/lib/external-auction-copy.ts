import type { Language } from "@/lib/types";

/** Legal-approved copy from marketplace#195 comment 7133921329 — keep in sync with Legal. */
export function externalAuctionSourceBadge(
  language: Language,
  sourceName: string,
): string {
  return language === "ro"
    ? `Licitație reală, externă · Sursa: ${sourceName}`
    : `Real external auction · Source: ${sourceName}`;
}

export function externalAuctionDisclaimer(
  language: Language,
  authority: string,
): string {
  return language === "ro"
    ? `Agregare informativă. Aceasta NU este o licitație LicitatieRO și nu poți licita aici. Licitația este organizată de ${authority}, conform propriilor reguli.`
    : `Informational aggregation. This is NOT a LicitatieRO auction and you cannot bid here. The auction is run by ${authority} under its own rules.`;
}

export function externalAuctionVerifyAtSource(
  language: Language,
  retrievalDateIso: string,
): string {
  const retrieval =
    language === "ro"
      ? new Date(retrievalDateIso).toLocaleDateString("ro-RO", {
          dateStyle: "medium",
        })
      : new Date(retrievalDateIso).toLocaleDateString("en-GB", {
          dateStyle: "medium",
        });
  return language === "ro"
    ? `Datele pot fi incomplete sau depășite (preluate la ${retrieval}). Verifică anunțul oficial înainte de orice decizie: Vezi anunțul oficial ↗`
    : `Details may be incomplete or out of date (retrieved ${retrieval}). Check the official notice before deciding: View official notice ↗`;
}

export function externalAuctionTakedown(language: Language): string {
  return language === "ro"
    ? "Nu afișăm date personale ale debitorilor. Dacă un anunț te privește sau vrei să fie eliminat, folosește formularul de raportare."
    : "We don't display debtors' personal data. If a notice concerns you or you want it removed, use the report form.";
}

export function externalAuctionPocNote(language: Language): string {
  return language === "ro"
    ? 'POC / Simulare: Licitațiile LicitatieRO marcate „simulare” sunt fictive. Anunțurile marcate „Licitație reală, externă” sunt reale, aparțin autorităților emitente și se desfășoară doar pe site-ul sursă.'
    : 'POC / Simulation: LicitatieRO auctions marked "simulation" are fictional. Notices marked "Real external auction" are real, belong to the issuing authority and take place only on the source site.';
}

export function externalAuctionRankingLine(language: Language): string {
  return language === "ro"
    ? "Ordonate după data licitației. Anunțurile externe nu pot fi promovate contra cost."
    : "Sorted by auction date. External notices cannot be paid-promoted.";
}

export function externalAuctionWithdrawnLabel(language: Language): string {
  return language === "ro"
    ? "Retrasă de la sursă"
    : "Withdrawn from source";
}

export function externalAuctionOfficialNoticeCta(language: Language): string {
  return language === "ro" ? "Vezi anunțul oficial" : "View official notice";
}
