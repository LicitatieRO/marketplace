## 0. Data contract (guest-safe)
MapListing = { id, slug, title, sector|neighbourhood, approxLat, approxLng, photoUrl, currentBidCents, minIncrementCents, startsAt, endsAt, status: 'scheduled'|'live'|'ended', isOwn?: boolean }
- Coordinates are approximate only: snap/jitter on the server, never on the client. Never show a street or number.
- owner_id is not public. isOwn is computed on the server for the session user and is absent for guests.
- status and time left come from server endsAt plus a server-time offset (no client-clock trust).

## 1. Price-pill marker (L.divIcon, HTML button)
formatEurCompact(cents) using Intl.NumberFormat(locale,{style:'currency',currency:'EUR',notation:'compact',maximumFractionDigits:1}); e.g. €125k / 125 k €, €1,2M / 1,2 mil. €. Under €10k, show the full amount with no decimals.
States: default (white/surface pill, 1px border token, text-sm 600, shadow-sm, 28px tall, 10px x-pad, small tail); hover/focus-visible (inverted, scale 1.06, z+100, also triggered by hovering the list card); selected (brand fill, white text, 2px ring offset, z+200, until another is selected or Esc); ended (muted, last price at 60% opacity, 'Incheiat'/'Ended' in the card only, still clickable); scheduled (outline pill, clock glyph + start price); own (dashed brand border + 'Al tău'/'Yours' dot with aria text, never a bid CTA); outbid buyer (amber dot top-right, explained in the card).
Cluster bubble (iconCreateFunction): circle 36/44/52px by count (<10, <100, >=100), surface fill, 3px brand ring, count text-sm 700; hover/focus thickens the ring; click zooms to bounds. Optional second line 'de la €95k'/'from €95k' at zoom>=13. maxClusterRadius 50, spiderfyOnMaxZoom true, showCoverageOnHover false.
Dark theme: surface/fg tokens swap; brand stays at >=4.5:1 on its fill.

## 2. Popup card
Desktop >=1024px: anchored 320px card beside the selected pill (custom overlay or L.popup className 'lr-map-card', autoPan padding 24). Mobile <1024px: bottom sheet (peek 40vh, drag/tap to 85vh), map visible above.
Content: 1) photo 16:9 lazy, alt=title, status chip (Live / Programat-Scheduled / Încheiat-Ended); 2) title (2-line clamp) and area 'Sector 2 · Floreasca (zonă aproximativă)' / '(approximate area)'; 3) current bid large with a POC / Simulare badge, then 'Pas minim: +€1.000' / 'Min. increment: +€1,000'; 4) time left 'Se încheie în 2z 4h' / 'Ends in 2d 4h', red with live seconds under 1h, plus 'Prelungit +2 min' / 'Extended +2 min' under anti-sniping; 5) bid control; 6) link 'Vezi proprietatea →' / 'View property →' to /listings/[slug].
Bid control states: guest = 'Autentifică-te pentru a licita'/'Sign in to bid' linking to /login?next=/map?listing=<id>&intent=bid (next must be a validated same-origin relative path; reopen the card after login; NEVER auto-submit a bid). Buyer live = stepper prefilled with current+min increment (-/+ by increment; typed value validated >= minimum) and 'Licitează'/'Place bid'. Own = disabled row 'Aceasta este proprietatea ta, nu poți licita.'/'This is your listing; you can't bid.' plus 'Gestionează'/'Manage' to /owner/... Outbid = amber banner 'Ai fost depășit. Oferta curentă: €X'/'You've been outbid. Current bid: €X' with stepper reset. Leading = green 'Ești pe primul loc'/'You're the highest bidder', stepper still allowed. Scheduled = 'Începe pe 18 nov., 10:00'/'Starts 18 Nov, 10:00' plus 'Urmărește'/'Watch', no bid. Ended = 'Licitație încheiată · Preț final €X (simulare)'/'Auction ended · Final price €X (simulated)', no control. Dual role = owner on own listings, buyer elsewhere (role from server).
Confirm step (required, inline panel, not a second modal): 'Confirmi oferta de €126.000? Aceasta este o simulare (POC). Nu se transferă bani și nu se creează nicio obligație legală.' / 'Confirm your €126,000 bid? This is a simulation (POC). No money moves and no legal obligation is created.' Buttons 'Confirm oferta'/'Confirm bid' (primary) and 'Anulează'/'Cancel'; spinner and both disabled while submitting; on server rejection (outbid) switch to the outbid state with the new minimum.

## 3. Layout
Desktop >=1024px: split view, list left 40% (scrolls; 1-2 card columns at >=1440px), map right 60% (sticky full height under the header), filters bar on top. Hovering a list card highlights its pill; selecting a pill scrolls to and highlights its card. Checkbox 'Caută când muți harta'/'Search as I move the map' (default on), with a 'Caută în această zonă'/'Search this area' button when it's off.
Mobile <1024px: list is the default; floating bottom-centre toggle 'Hartă'/'Map' (or 'Listă'/'List'), with result count e.g. 'Hartă · 24'. Map full height under filters; a selected pill opens the bottom sheet. Keep the selected listing and viewport in the URL (?view=map&listing=<id>&bbox=...) for back/forward and share.
No consent (OSM tiles are third-party): the list works fully; the map area shows a placeholder 'Harta folosește OpenStreetMap și se încarcă doar cu acordul dvs.'/'The map uses OpenStreetMap and only loads with your consent.' with 'Acceptă și afișează harta'/'Accept and show map' (sets the consent flag and lazy-imports Leaflet) and 'Detalii'/'Details' to /privacy#maps. Don't import Leaflet or its CSS before consent. On mobile, the toggle opens this placeholder. Reuse the existing map consent gate.
Empty results: 'Nicio proprietate în această zonă. Micșorează harta sau resetează filtrele.'/'No properties in this area. Zoom out or reset filters.'

## 4. Accessibility
Pills are real <button>s in the divIcon, with aria-label like 'Floreasca, ofertă curentă 125.000 EUR, se încheie în 2 zile'; in tab order after the list; skip link 'Sari la listă'/'Skip to list'. Tab/Shift+Tab moves between pills in list order; Enter/Space opens the card; arrow keys pan when the map container is focused. Clusters are buttons: 'Grup de 12 proprietăți, apasă pentru zoom'/'Cluster of 12 properties, press to zoom'. Card/sheet role=dialog, aria-modal=true on mobile only (desktop is a non-modal popover, aria-labelledby=title); focus moves to the title on open; Tab is trapped in the mobile sheet; Esc closes it, returns focus to the pill and clears ?listing; the confirm panel focuses its primary button, and Esc there cancels only the confirm. aria-live=polite for outbid, extension and result-count changes (countdown not announced every second). Colour is never the only signal. Hit targets >=44px on mobile. Respect prefers-reduced-motion.

## Implementation notes (map UX)

- `/map` writes `view=map` when the mobile map surface is active (`list` omits the param).
- Countdown copy uses map API `serverNowMs` offset; list rows show photo, price neighbourhood, and time line.
- Pill and cluster `aria-label` strings follow the active locale (RO/EN).

## 5. Acceptance checklist
- No exact address or owner_id in guest payloads; coordinates approximate (fuzzed, <=3dp).
- Leaflet isn't loaded before consent; the list works without it.
- Guest bid leads to login with a validated next, back to the same card, no auto-submit.
- The owner can't bid on their own listing (UI and server).
- Confirm step plus POC / Simulare on every amount and bid action.
- Works at 375px and >=1024px, light and dark, RO and EN.
- Keyboard-only flow: pill, card, confirm, Esc, back to the pill.