"use client";

import { Suspense, type ReactNode } from "react";
import { TourProvider } from "@/components/tour/tour-context";
import { TourQuerySync } from "@/components/tour/tour-query-sync";

export function TourShell({ children }: { children: ReactNode }) {
  return (
    <TourProvider>
      <Suspense fallback={null}>
        <TourQuerySync />
      </Suspense>
      {children}
    </TourProvider>
  );
}
