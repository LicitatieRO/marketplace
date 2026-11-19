export type MapPricePillState = {
  selected?: boolean;
  highlighted?: boolean;
  ended?: boolean;
  scheduled?: boolean;
  own?: boolean;
  outbid?: boolean;
};

const PRICE_PILL_CLASS_ALLOWLIST = new Set([
  "lr-price-pill",
  "is-selected",
  "is-highlighted",
  "is-ended",
  "is-scheduled",
  "is-own",
]);

const LISTING_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export function escapeMapPricePillText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeMapPricePillAttr(value: string): string {
  return escapeMapPricePillText(value);
}

function sanitizeListingId(listingId: string): string {
  const trimmed = listingId.trim();
  if (!LISTING_ID_PATTERN.test(trimmed)) return "";
  return trimmed.toLowerCase();
}

function sanitizeClassNames(className: string): string {
  return className
    .split(/\s+/)
    .filter((token) => token && PRICE_PILL_CLASS_ALLOWLIST.has(token))
    .join(" ");
}

export function mapPricePillClassName(state: MapPricePillState = {}): string {
  return [
    "lr-price-pill",
    state.selected ? "is-selected" : "",
    state.highlighted ? "is-highlighted" : "",
    state.ended ? "is-ended" : "",
    state.scheduled ? "is-scheduled" : "",
    state.own ? "is-own" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function mapPricePillButtonHtml(
  priceLabel: string,
  listingId: string,
  ariaLabel: string,
  state: MapPricePillState = {},
): string {
  const classes = sanitizeClassNames(mapPricePillClassName(state));
  const safeId = sanitizeListingId(listingId);
  const safePrice = escapeMapPricePillText(priceLabel);
  const safeAria = escapeMapPricePillAttr(ariaLabel);
  const ownDot = state.own
    ? '<span class="lr-own-dot" aria-hidden="true"></span>'
    : "";
  const outbidDot = state.outbid
    ? '<span class="lr-outbid-dot" aria-hidden="true"></span>'
    : "";
  return `<button type="button" class="${classes}" data-listing-id="${escapeMapPricePillAttr(safeId)}" aria-label="${safeAria}">${safePrice}${ownDot}${outbidDot}</button>`;
}
