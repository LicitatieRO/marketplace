"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { parseTourQueryParam } from "@/lib/tour/parse-tour-query";
import { useProductTour } from "@/components/tour/tour-context";

export function TourQuerySync() {
  const searchParams = useSearchParams();
  const { startTour, running, forceOff } = useProductTour();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get("tour");
    const parsed = parseTourQueryParam(raw);
    const signature = `${raw ?? ""}:${parsed.kind}`;
    if (handled.current === signature) return;
    if (parsed.kind === "off") {
      handled.current = signature;
      forceOff();
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("tour");
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState(null, "", next);
      }
      return;
    }
    if (parsed.kind === "start" && !running) {
      handled.current = signature;
      startTour(parsed.tour, 0);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("tour");
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState(null, "", next);
      }
    }
  }, [forceOff, running, searchParams, startTour]);

  return null;
}
