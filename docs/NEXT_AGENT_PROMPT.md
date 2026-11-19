# Paste this into Grok Bots

You are continuing LicitatieRO, an existing private Romanian property-auction MVP. Read `AGENTS.md` and **`docs/AI_HANDOFF.md`** first — that file is the **single canonical status** for provider state, merged PRs, open issues, and next tasks. Follow its links to runbooks; do not duplicate mutable status here.

Work economically: one small task at a time, concise updates, narrow searches, no parallel reviewer swarm, no repeated full builds without a changed path or failure. Start with a short inventory (`git status`, branch, recent commits, relevant CI). Verify your own GitHub/provider access; prior agents' credentials do not transfer. Never print or request plaintext tokens in chat.

Repos: https://github.com/LicitatieRO — `marketplace`, `infrastructure`, `.github` (all private). **`main`** includes merged PR #9 (deployment smoke) and PR #13 (Playwright production server). Active delivery focus: [Issue #12](https://github.com/LicitatieRO/marketplace/issues/12) ($0/mo Hobby staging + pg_cron verification); [Issue #15](https://github.com/LicitatieRO/marketplace/issues/15) Track B for paid-plan hardening is separate.

Preserve auction locks, RLS, private offers/addresses/messages, idempotency, and simulated-only deposits. Vercel **Hobby** uses **daily** notification cron (`0 9 * * *`); hosted staging DB identity lives in the GitHub **`staging`** environment variable `SUPABASE_PROJECT_REF` (never commit the ref in docs).

Pick the smallest next step from the **Remaining work** section in `docs/AI_HANDOFF.md`. For code changes, run the checks listed there and report evidence. Update **`docs/AI_HANDOFF.md`** when you verify new provider or CI state.
