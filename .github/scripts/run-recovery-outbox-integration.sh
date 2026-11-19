#!/usr/bin/env bash
# CI: requires APP_SENT_RECOVERY_ENABLED on the running application server.
set -euo pipefail

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

node --env-file=.env.local --test tests/integration/auth-recovery-outbox.test.mjs | tee "$log"
grep -q 'RECOVERY_OUTBOX=verified' "$log"
