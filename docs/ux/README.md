# UX variant architecture — index

Committed UX architecture and variant documentation for LicitatieRO marketplace (docs-only; no application code in this folder).

## Resources

| Resource | Location |
| --- | --- |
| **Architecture blueprint (this repo)** | [variant-blueprint.md](./variant-blueprint.md) |
| **Interactive prototype** — Homepage & Catalogue Canvas | **Internal only** (not published). Not reachable from this GitHub repo; use the blueprint until a committed spec lands. |
| **Full engineering reference (716 lines)** | **Internal only** — Grok Bot Library artifact `licitatiero-ux-variant-specs.md` (not in repo). This blueprint is the collaborator-facing summary. |

## Core UX philosophy

**Phone-first baseline, fully functional and advanced on desktop.**

*— Florentin, 14 November 2026*

Native mobile ergonomics at `375px` are the design baseline. Desktop (`≥1024px`) scales into a full workspace (split views, dense comparison tables, multi-column operations) without regressing the narrow-screen experience.

**Variant scope:** Visual re-skin and layout tokens (`?variant=a|b|c|classic`) are variant-scoped. The **PR-UX0** legal/POC disclosure layer (always-on POC banner, qualified status labels, acknowledgement checkboxes, consent gates, `/legal/*`) applies to **all** variants, including **`classic`**.

For constraints, variants, surfaces, legal layers, PR sequencing, and open decisions, see [variant-blueprint.md](./variant-blueprint.md).
