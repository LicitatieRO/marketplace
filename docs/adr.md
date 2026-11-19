# Architecture decisions

Status: approved MVP direction; deployment/account verification is tracked separately. Scope is Bucharest real estate. Goods, wallets, rewards, events, banner advertising and AI valuation are deferred.

## ADR 1 — One property is the concurrency boundary

A physical property can have sale and rent listings, but a shared property record owns eligibility and mutually exclusive state. Link listing IDs to property IDs. Enforce one open auction and one active reservation per physical property through constraints and transactions, including cross-listing requests.

All competing mutations first lock the **property row**, then related auction/reservation rows in a consistent order. Read authoritative server time **after acquiring the lock**. This prevents requests waiting at a deadline from being accepted using stale pre-lock time. Bids validate minimum increments, visibility and caller eligibility inside the same transaction. Idempotency keys bind actor, operation and request payload so retries return the original result; a reused key with conflicting input fails. A shared conflict response reports property-level unavailability across either listing. The UI can refresh optimistically but cannot decide ownership or deadlines.

## ADR 2 — PostgreSQL is authoritative; RLS is mandatory

Use Next.js/TypeScript with server-only Supabase Auth integration and user-scoped database clients. RLS and RPC authorization must independently reject unauthenticated, unrelated and ineligible users. Anonymous catalogue output excludes exact address, private documents, confidential offers and private conversations. Verified email is required for account mutations; staff require MFA before privileged operations. Route handlers validate input/CSRF and never grant arbitrary RPC names. Documents live in private Storage with short-lived authorized access.

Public ascending versus confidential offers describes price visibility. Public versus invite-only eligibility is a separate setting. Owner selection follows closure; a public highest offer does not silently award ownership. Authenticated callers still need property/message/viewing scope checks. Logs exclude secrets and unnecessary personal data.

## ADR 3 — Simulation first, regulated integrations later

The MVP records simulated funding only and explicitly discloses that limitation. No balance, escrow, custody or investment return claim. Refund simulation precedes an external contract; signed tenancy can enable a disclosed investment sale. Rental reservation is distinct from a security deposit. A live money flow requires legal/accounting review, external custodian agreement, verified technical integration, KYC/AML allocation, reconciliation, dispute handling and PITR/restore readiness. An owner's identity proof is not proof of property ownership.

## ADR 4 — Separate environments and forward recovery

Vercel Pro app and Supabase PostgreSQL/Auth/Storage use separate staging/production projects, Frankfurt region where supported. Migrations are versioned, additive first and tested against a disposable real backend. Deploy only exact CI-tested main commits. Staging automation and founder-controlled production dispatch use distinct credentials. Schema rollback is manual and exceptional; application rollback depends on backward compatibility. Environment labels alone are not evidence of independent release approval.

## ADR 5 — Durable notifications and bounded integrations

Persist notification intent in a transactionally written outbox alongside business state; deliver after commit with an idempotent worker, bounded retries/exponential backoff, attempt tracking and a dead-letter/operator review state. Never hold property locks while calling an email provider. Current source/worker enablement must be checked before claiming delivered mail; a queued row is not delivery confirmation. Start with Resend and verified SPF/DKIM, then add channels when operational capacity warrants them.

## ADR 6 — Scale by measured pressure, preserve contracts

Below 500 weekly active users, keep one application and one transactional database. At 500+ WAU measure database waits, connection use, media egress, job age and per-route latency before buying capacity. At a 2,500 WAU base and 10,000 WAU stress case, add pooling, tuned indexes, storage/CDN policies and separate background workers while preserving the property-lock/RLS/API contracts. These boundaries avoid a rewrite triggered by an arbitrary user count. Sharding, a second transaction store and microservices are deferred until measured saturation justifies complexity.
