# Local dependency license review

This document describes how to run the **license auditor CLI**. It is not the package inventory itself. The checked-in inventory snapshot lives in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) and [license-review-needed.json](license-review-needed.json). [dependency-audit-baseline.json](dependency-audit-baseline.json) holds npm **security advisory** baselines only, not license metadata.

Run from the repository root with Node.js (the application targets Node 26):

```sh
node scripts/audit-licenses.mjs
node scripts/audit-licenses.mjs --json
node --test scripts/audit-licenses.test.mjs
```

No installation, network access, paid scanner, environment secrets or new CI cost is required. The command reads the lockfile and policy and writes only stdout/stderr. It does not read package downloads, `resolved` URLs, installed package contents or `.env` files. `--lockfile PATH` and `--policy PATH` select explicit inputs; defaults are relative to the script, so they also work from another directory. Repeated/unknown CLI options are errors.

Exit codes are **0** for a fully approved inventory, **1** for license review findings and **2** for invalid/unreadable input or configuration. A review finding flags a decision still needed; it does not prove that a package is legally unusable.

## Inventory and limits

The input is the `packages` inventory of an npm lockfile, version 2 or 3. The root application entry is excluded. Every other entry counts, including dev, transitive and optional dependencies for platforms not used locally. This deliberately supports cross-platform review rather than estimating only the deployed artifact. Counts are per installed path; findings with the same package, version, declared license and reason share a sorted list of paths. An explicit package `name` identifies npm aliases; otherwise the final package name is derived from its installed path, including scopes and nested `node_modules`.

Missing/malformed inventories, missing versions, non-exact versions and unsupported paths produce an input error rather than a clean audit. This version supports `node_modules` package paths; workspace/source/link paths need a separate inventory extension. A valid root-only inventory has zero dependency entries. Missing, empty, array/object or otherwise ambiguous license metadata stays unresolved; legacy `licenses` metadata is not inferred into an approval.

The parser handles identifiers, uppercase `AND`/`OR`, whitespace and parentheses. `AND` binds more tightly than `OR`; all terms of an `AND` must be approved and one complete `OR` choice is sufficient. The entire expression is parsed before evaluation, so malformed or extra tokens cannot hide behind an approved choice. `WITH` anywhere requires manual review, even in an otherwise approved `OR` branch; exceptions are never dropped. Expressions longer than 4,096 characters or nested more than 64 parentheses are unresolved.

This is a bounded expression parser, **not a complete SPDX registry or conformance validator**. Identifier syntax is ASCII letters/digits followed by letters/digits/dots/plus/hyphens; unknown identifiers get no implicit approval. No license identifier aliases, deprecated-ID conversion, `LicenseRef` resolution, `SEE LICENSE IN` files or natural-language license text interpretation is performed. The policy uses exact, case-sensitive identifiers. Metadata can be wrong or incomplete: legal review still needs the actual license/notice texts, provenance, distributed artifacts, use and applicable obligations. An approved result is a policy match against declared metadata, not a legal opinion or proof that notices/attribution obligations were fulfilled.

## Policy and review process

`docs/license-allowlist.json` has exactly `version` (currently `1`), `allowedLicenses` (a nonempty array of unique exact identifiers) and `exceptions` (an array). Its conservative defaults are MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, CC0-1.0 and Unlicense. There is no wildcard BSD approval or automatic LGPL/MPL/CC-BY/BlueOak approval. Policy structure, wildcard identifiers, duplicate identifiers and malformed exception entries are rejected.

Zero approved exceptions ship with this audit. A reviewer with authority to approve the intended use must investigate each finding and document the decision. An exception, if separately approved, must contain **exactly** these fields:

- `package`: exact package name, including a scope when present; no wildcards.
- `version`: exact `major.minor.patch` version (optional prerelease/build suffix), without ranges.
- `expression`: exact declared license string, parsed successfully by this auditor.
- `reason`: nonempty explanation of the approved use and obligations.
- `source`: nonempty reference to the supporting evidence/review record.
- `reviewer`: nonempty attribution to the approving reviewer.

The identity, version and expression must all match without normalization. Duplicate exception identities are errors; missing metadata, malformed expressions and unsupported `WITH` expressions cannot be excused by an exception. Changing the default allowlist is a separate review decision with broader impact than an exact exception. Adding entries merely to obtain exit 0 is not a review process.

## Current review snapshot and refresh

`docs/license-review-needed.json` records the current lockfile SHA-256, inventory counts and sorted review findings (package/version, declared license, installed paths and reasons). It contains no timestamps or resolved/download URLs. The current inventory has **520 entries: 488 approved and 32 requiring review**: 14 LGPL-bearing sharp/libvips entries, 13 MPL entries (lightningcss and axe-core), four BlueOak entries and one CC-BY entry (caniuse-lite). Some are optional platform packages. No current entry has missing license metadata.

After an intentional dependency/lockfile or reviewed policy change, rerun the auditor and refresh the snapshot through shell redirection:

```sh
node scripts/audit-licenses.mjs --json > docs/license-review-needed.json
# Exit 1 is expected while findings remain; exit 2 means the input/config must be fixed.
```

Inspect the exit code and review the generated diff before committing. A checked-in snapshot is evidence of pending review, never a baseline exemption: its presence does not alter findings or suppress exit 1. The lockfile hash detects stale inventory evidence; regenerate whenever policy changes too. The JSON report contains counts and grouped findings, not an independent copy of approved package metadata.

`npm run security:audit` remains the separate vulnerability/advisory audit with its own baseline. It does not answer license questions. This change adds no package scripts, dependency changes, workflows or pipeline gate; pipeline integration belongs to a separate owner. The standalone checks were exercised under the available Node 24.22.1 runtime; application Node 26 validation remains separate.

Human-readable attribution and LGPL notices for reviewed third-party packages live at the repository root in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
