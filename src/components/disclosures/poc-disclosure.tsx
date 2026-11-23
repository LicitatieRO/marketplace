"use client";
import { usePlatform } from "@/components/platform";
import { pocSiteBanner } from "./legal-copy";
export function PocSiteBanner() {
  const { t } = usePlatform();
  return (
    <div
      className="demo-banner"
      role="status"
      data-testid="poc-simulation-banner"
      data-tour="poc-simulation"
    >
      <span className="status-dot" />
      <div>
        <strong>{t(pocSiteBanner.titleRo, pocSiteBanner.titleEn)}</strong>
        {" — "}
        {t(pocSiteBanner.bodyRo, pocSiteBanner.bodyEn)}
      </div>
    </div>
  );
}