#!/usr/bin/env bash
# Fail-closed wrapper for classify-ci.mjs GitHub Actions output.
set -euo pipefail

append_full_suite_fallback() {
  {
    echo 'quality-mode=full'
    echo 'backend-mode=full'
    echo 'tier=full'
    echo 'reason<<EOF'
    echo 'Classifier failed or returned unexpected output; falling back to full suite'
    echo 'EOF'
  } >>"${GITHUB_OUTPUT}"
}

classifier_out=""
classifier_status=0
set +e
classifier_out="$(node .github/scripts/classify-ci.mjs)"
classifier_status=$?
set -e

if [ "${classifier_status}" -ne 0 ]; then
  echo "::warning::CI classifier exited ${classifier_status}; using full suite."
  append_full_suite_fallback
  exit 0
fi

if [ -z "${classifier_out//[$'\t\r\n ']/}" ]; then
  echo "::warning::CI classifier returned empty output; using full suite."
  append_full_suite_fallback
  exit 0
fi

quality_mode="$(printf '%s\n' "${classifier_out}" | grep -E '^quality-mode=' | head -n1 | cut -d= -f2-)"
backend_mode="$(printf '%s\n' "${classifier_out}" | grep -E '^backend-mode=' | head -n1 | cut -d= -f2-)"
tier="$(printf '%s\n' "${classifier_out}" | grep -E '^tier=' | head -n1 | cut -d= -f2-)"
valid=1
if [ -z "${quality_mode}" ] || [ -z "${backend_mode}" ] || [ -z "${tier}" ]; then
  valid=0
fi
case "${quality_mode}" in minimal|full) ;; *) valid=0 ;; esac
case "${backend_mode}" in skip|e2e|full) ;; *) valid=0 ;; esac
case "${tier}" in docs-only|app-only|full) ;; *) valid=0 ;; esac
if ! printf '%s\n' "${classifier_out}" | grep -q '^reason<<EOF'; then
  valid=0
fi

if [ "${valid}" -eq 0 ]; then
  echo "::warning::CI classifier returned unexpected output; using full suite."
  append_full_suite_fallback
  exit 0
fi

printf '%s\n' "${classifier_out}" >>"${GITHUB_OUTPUT}"