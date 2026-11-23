"use client";

import { useState } from "react";
import { ArrowUpRight, Maximize2 } from "lucide-react";
import { useAllowsOptionalContent } from "@/components/disclosures/cookie-consent-banner";
import { openCookiePreferences } from "@/lib/optional-content-events";
import { safeEmbedTourUrl } from "@/lib/tour-url";
import { usePlatform } from "./platform";

export function ListingTour360({
  tourUrl,
}: {
  tourUrl?: string | null;
}) {
  const { t } = usePlatform();
  const allowsOptionalContent = useAllowsOptionalContent();
  const [tourOpen, setTourOpen] = useState(false);
  const safeTour = safeEmbedTourUrl(tourUrl);

  if (!safeTour) {
    return (
      <p className="muted small">
        {t(
          "Tur virtual: nu a fost furnizat de proprietar.",
          "Virtual tour: not provided by the owner.",
        )}
      </p>
    );
  }

  return (
    <div className="virtual-tour">
      <div className="tour-heading">
        <div>
          <h3>
            {t(
              "Privește în jur. De oriunde.",
              "Take a look around. From anywhere.",
            )}
          </h3>
          <p>
            {t(
              "Turul este găzduit de un furnizor extern. Se încarcă doar când îl deschizi și atunci partajează date de conexiune cu furnizorul.",
              "This tour is hosted by an external provider. It loads only when you open it, sharing connection data with that provider.",
            )}
          </p>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (!allowsOptionalContent) {
              openCookiePreferences();
              return;
            }
            setTourOpen(!tourOpen);
          }}
        >
          {tourOpen
            ? t("Închide turul", "Close tour")
            : t("Deschide turul 360°", "Open 360° tour")}
          <Maximize2 size={15} />
        </button>
      </div>
      {tourOpen && allowsOptionalContent ? (
        <iframe
          className="tour-embed"
          src={safeTour}
          title={t("Tur virtual al proprietății", "Property virtual tour")}
          loading="lazy"
          allow="fullscreen; accelerometer; gyroscope"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <a
        className="text-link"
        href={safeTour}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          if (!allowsOptionalContent) {
            event.preventDefault();
            openCookiePreferences();
          }
        }}
      >
        {t(
          "Deschide pe site-ul furnizorului",
          "Open on the provider’s website",
        )}
        <ArrowUpRight size={14} />
      </a>
    </div>
  );
}