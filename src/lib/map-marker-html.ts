import { escapeHtml, escapeHtmlAttribute } from "@/lib/html-escape";

export function buildMapClusterMarkerHtml(count: number, ariaLabel: string): string {
  const safeCount = Number.isFinite(count)
    ? Math.max(0, Math.floor(count))
    : 0;
  const countHtml = escapeHtml(String(safeCount));
  return `<button type="button" class="lr-cluster" aria-label="${escapeHtmlAttribute(ariaLabel)}"><span>${countHtml}</span></button>`;
}