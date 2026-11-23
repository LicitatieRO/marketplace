import type { TourKind } from "./types";

export type ParsedTourQuery =
  | { kind: "off" }
  | { kind: "start"; tour: TourKind; resumeStep?: number }
  | { kind: "noop" };

export function parseTourQueryParam(
  value: string | null | undefined,
): ParsedTourQuery {
  if (value == null || value === "") return { kind: "noop" };
  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized === "off" || normalized === "false") {
    return { kind: "off" };
  }
  if (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "buyer" ||
    normalized === "guest"
  ) {
    return { kind: "start", tour: "buyer" };
  }
  if (normalized === "owner") {
    return { kind: "start", tour: "owner" };
  }
  return { kind: "noop" };
}