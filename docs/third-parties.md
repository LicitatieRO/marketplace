# Provider and legal readiness

This matrix distinguishes a technical option from an established account or contract. A provider's public API documentation is not proof this business is eligible or has credentials. All account-backed claims below require founder verification before activation.

| Provider / capability | MVP boundary and action | Status / cost assumption |
| --- | --- | --- |
| GitHub | Three private organization repos; Team for private branch protections | Organization membership, plan and remote writes require observed verification |
| Vercel | Separate staging/production projects under explicit team scope | Pro budget assumption; verify plan, region and team billing |
| Supabase | PostgreSQL/Auth/Storage in Frankfurt, RLS, backups/PITR | Separate refs/credentials; PITR before live funds; confirm plan/retention |
| Resend | Outbox email after commit; retry/deduplicate | Verify sender domain SPF/DKIM and appropriate DMARC; account and deliverability unverified |
| BCR / custodian | Manual commercial/legal discovery only | Custody/API suitability and agreement **not verified**; no live escrow claim |
| Stripe | Payment for platform-owned listing promotions only | Eligibility/KYC required; Romanian standard EEA card reference is **1.5% + 1 RON**; verify live account/pricing/card class before charging. Not a custody solution for property funds |
| Kuula / Matterport | Embedded virtual tours via active commercial account/plan | Confirm embed branding, privacy/cookies and commercial SDK/plan permissions; generic embed support does not grant SDK rights |
| OpenStreetMap (Leaflet tiles) | Catalogue map uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` by default (`NEXT_PUBLIC_MAP_TILE_URL` overrides must be **https** and use host `tile.openstreetmap.org` only unless `MAP_TILE_HOST_ALLOWLIST` in `src/lib/map-tiles.ts` is extended and documented here); attribution overrides must still credit OpenStreetMap (`…/copyright`); consent-gated before the first tile request; approximate pins only | No commercial tile contract claimed for this POC; follow [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) and attribution rules |
| Protomaps PMTiles (offline fallback) | Dormant self-hosted extract `data/tiles/bucharest-ilfov.pmtiles` (Bucharest + Ilfov, z0–15), served at `/tiles/bucharest-ilfov.pmtiles` with HTTP Range; Git LFS; activated when `MAP_TILE_PROVIDER=pmtiles` or OSM failover; lazy-loaded client libs (`pmtiles`, `protomaps-leaflet`); same-origin path allowlisted in `src/lib/map-tiles.ts`; see [map-tile-fallback runbook](runbooks/map-tile-fallback.md) | OSM data via Protomaps daily planet build (ODbL); no Protomaps API key |
| MapTiler | Optional maps with API-origin/key restrictions | US$30/month planning option, not required MVP cost or guaranteed current quotation; verify plan/usage |
| ROeID | Possible owner identity verification research | Eligibility/integration approval **unverified**; identity does not prove ownership/title |
| SmartBill / Oblio | Invoicing/e-Factura integration after accountant selects workflow | API/account/plan and current regulatory mapping pending accountant review |
| FAN Courier / Sameday | Future goods logistics | Deferred; requires merchant contract and credentials, not relevant to current real-estate MVP |

No provider credential has to be pasted into a document or chat. Configure through account dashboards and secret stores. Provider logos/names do not imply endorsement or a signed contract. Disable an unavailable integration explicitly; do not show a fake successful delivery/payment.

## Legal model review

Obtain Romanian/EU counsel and accountant review of the actual business model, user roles and payment flows. GDPR privacy notices, legal bases, processor agreements, retention, data subject requests, access controls and breach response need implementation evidence. Decide whether and how DAC7 reporting, DSA intermediary/platform duties, consumer law, AML/KYC and payment/custody rules apply. The MVP's simulation-only boundary reduces some risks but is **not a blanket exemption**. Avoid gathering property documents or identity data without defined necessity and retention.

Confirm owner authority/title verification separately from email or ROeID identity, and disclose signed tenancy accurately when an investment sale is enabled. External lawyers/notaries/contracts complete property transactions; a platform reservation or winning offer is not itself a transfer of ownership. Rental security deposits, reservation holds, purchase deposits and service fees require separate legal/accounting definitions before any real payment.

Tour/map embeds may contact third parties and use cookies; assess consent, data transfers and iframe policy before enabling them. Resend DNS instructions must come from the actual verified sending-domain configuration; do not invent DNS records. Separate transactional communication from marketing consent and ensure unsubscribe/objection handling where applicable.

Official sources to recheck at activation: [Stripe Romania pricing](https://stripe.com/en-ro/pricing), [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [MapTiler plans](https://www.maptiler.com/cloud/pricing/), [Kuula plans](https://kuula.co/page/pricing), [Matterport plans](https://matterport.com/plans), [ROeID](https://www.roeid.ro/), [SmartBill API](https://api.smartbill.ro/), [Oblio API](https://www.oblio.eu/api), [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [DAC7](https://eur-lex.europa.eu/eli/dir/2021/514/oj), [DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj).
