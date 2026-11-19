#!/usr/bin/env bash
set -euo pipefail

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

node --env-file=.env.local --test tests/integration/auth-recovery-callback.test.mjs | tee "$log"
grep -q 'RECOVERY_CALLBACK=verified' "$log"