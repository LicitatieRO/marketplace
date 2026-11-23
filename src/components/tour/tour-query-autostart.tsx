"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useProductTour } from "@/components/tour/tour-context";

export function TourQueryAutoStart() {
  const searchParams = useSearchParams();
  const { startTour } = useProductTour();
  const started = useRef(false);

  useEffect(() => {
    if (searchParams.get("tour") !== "1") {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    startTour(0);
  }, [searchParams, startTour]);

  return null;
}