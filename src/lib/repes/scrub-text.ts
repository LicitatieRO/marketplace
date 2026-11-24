const SCRUB_INPUT_MAX = 500;

const CNP_PATTERN = /\b[12]\d{12}\b/g;
const CF_PATTERN =
  /\b(?:c\.?\s*f\.?|carte\s+funciar[ăa])\s*(?:nr\.?\s*)?[:#-]?\s*\d+/giu;
const CF_SHORT_PATTERN = /\bcf\s+nr\.?\s*\d+/giu;
const CADASTRAL_PATTERN = /\bcadastral\w*\s*(?:nr\.?\s*)?[:#-]?\s*\d+/giu;
const DEBTOR_CREDITOR_PATTERN =
  /\b(?:debitor|creditor|debitorul|creditorul)\b[^.;,\n]{0,120}/giu;
const PERSONAL_NAME_AFTER_ROLE =
  /\b(?:debitor|creditor)\s+(?:[A-ZĂÂÎȘȚ][\p{L}'-]+(?:\s+[A-ZĂÂÎȘȚ][\p{L}'-]+)+)/giu;
const CASE_FILE_PATTERN =
  /\b\d{1,6}\s*\/\s*ex\s*\/\s*\d{4}\b/giu;
const DOSAR_EXECUTARE_PATTERN =
  /\bdosar\s*(?:\(de\)\s*)?execut(?:are|arii)\s*nr\.?\s*[:#]?\s*[\w/-]+/giu;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN = /(?:\+40|0)\s*[\d\s.-]{8,14}/g;
const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;
const PLATE_PATTERN =
  /\b(?:nr\.?\s*)?(?:înmatriculare|inmatriculare|plate)?\s*[:\s-]*[A-Z]{1,2}[\s-]*\d{2,3}[\s-]*[A-Z]{3}\b/giu;
const PLATE_COMPACT_PATTERN = /\b[A-Z]{1,2}\s*-?\s*\d{2,3}\s*-?\s*[A-Z]{3}\b/g;
const STREET_ADDRESS_PATTERN =
  /\b(?:str\.?|strada|bd\.?|bulevardul|șos\.?|sos\.?|șoseaua|soseaua|calea|aleea)\s+(?:[\p{L}'-]+\s+)*(?:nr\.?\s*)?\d+[A-Za-z]?/giu;
const OWNER_CONTEXT_PATTERN =
  /\b(?:proprietar|patron|titular|reprezentant)\w*\s*[:\s]+(?:[A-ZĂÂÎȘȚ][\p{L}'-]+(?:\s+[A-ZĂÂÎȘȚ][\p{L}'-]+){0,3})/giu;

export function truncateForScrub(text: string, max = SCRUB_INPUT_MAX): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export function stripSensitiveFragments(text: string): string {
  const bounded = truncateForScrub(text);
  return bounded
    .replace(DEBTOR_CREDITOR_PATTERN, "")
    .replace(PERSONAL_NAME_AFTER_ROLE, "")
    .replace(CNP_PATTERN, "")
    .replace(CF_PATTERN, "")
    .replace(CF_SHORT_PATTERN, "")
    .replace(CADASTRAL_PATTERN, "")
    .replace(DOSAR_EXECUTARE_PATTERN, "")
    .replace(CASE_FILE_PATTERN, "")
    .replace(VIN_PATTERN, "")
    .replace(PLATE_PATTERN, "")
    .replace(PLATE_COMPACT_PATTERN, "")
    .replace(STREET_ADDRESS_PATTERN, "")
    .replace(OWNER_CONTEXT_PATTERN, "")
    .replace(EMAIL_PATTERN, "")
    .replace(PHONE_PATTERN, "");
}

/** Scrub free-text snippets (tests prove embedded PII removal). */
export function scrubRepesFreeText(text: string): string {
  return stripSensitiveFragments(text).replace(/\s+/g, " ").trim();
}
