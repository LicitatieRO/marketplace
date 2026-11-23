"use client";

import { Suspense, type ReactNode } from "react";
import { TourProvider } from "@/components/tour/tour-context";
import { TourQueryAutoStart } from "@/components/tour/tour-query-autostart";

export function TourShell({ children }: { children: ReactNode }) {
  return (
    <TourProvider>
      <Suspense fallback={null}>
        <TourQueryAutoStart />
      </Suspense>
      {children}
    </TourProvider>
  );
}