"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import { usePlatform } from "@/components/platform";
import {
  pocBannerCollapseLabel,
  pocBannerCollapsedLine,
  pocBannerExpandLabel,
} from "@/lib/i18n";
import { pocSiteBanner } from "./legal-copy";

export function PocSiteBanner() {
  const { t } = usePlatform();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const summary = t(pocBannerCollapsedLine.ro, pocBannerCollapsedLine.en);

  return (
    <div
      className={`demo-banner demo-banner-poc${expanded ? " is-expanded" : " is-collapsed"}`}
      role="status"
      data-testid="poc-simulation-banner"
      data-tour="poc-banner"
      aria-label={t(pocSiteBanner.titleRo, pocSiteBanner.titleEn)}
    >
      <span className="status-dot" aria-hidden />
      <div className="demo-banner-poc-inner">
        {!expanded ? (
          <p className="demo-banner-poc-summary">
            <strong>{t(pocSiteBanner.titleRo, pocSiteBanner.titleEn)}</strong>
            {" · "}
            {summary}
          </p>
        ) : null}
        <div
          id={detailsId}
          className={`demo-banner-poc-body${expanded ? "" : " is-sr-only"}`}
          aria-hidden={!expanded}
        >
          <strong>{t(pocSiteBanner.titleRo, pocSiteBanner.titleEn)}</strong>
          {" — "}
          {t(pocSiteBanner.bodyRo, pocSiteBanner.bodyEn)}
        </div>
        <button
          type="button"
          className="demo-banner-poc-toggle button link-button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded
            ? t(pocBannerCollapseLabel.ro, pocBannerCollapseLabel.en)
            : t(pocBannerExpandLabel.ro, pocBannerExpandLabel.en)}
          {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
