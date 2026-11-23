"use client";
import { usePlatform } from "@/components/platform";
import { stagingDemoBanner } from "./legal-copy";

export function StagingDemoBanner() {
  const { t } = usePlatform();
  return (
    <div
      className="staging-demo-banner"
      role="status"
      data-testid="staging-demo-banner"
    >
      {t(stagingDemoBanner.ro, stagingDemoBanner.en)}
    </div>
  );
}