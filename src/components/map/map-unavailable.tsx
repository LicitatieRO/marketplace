import Link from "next/link";
import { usePlatform } from "@/components/platform";

export function MapGloballyUnavailable() {
  const { t } = usePlatform();
  return (
    <div
      className="feedback notice"
      data-testid="map-globally-unavailable"
      role="status"
    >
      <p style={{ fontWeight: 600 }}>
        {t(
          "Harta nu este disponibilă momentan",
          "Map is currently unavailable",
        )}
      </p>
      <p className="muted small">
        {t(
          "Poți folosi în continuare lista de proprietăți.",
          "You can still use the property list.",
        )}
      </p>
    </div>
  );
}

export function MapOutsideExtractOverlay({
  listHref = "#catalogue-listings",
}: {
  listHref?: string;
}) {
  const { t } = usePlatform();
  return (
    <div
      className="map-outside-extract-overlay"
      data-testid="map-outside-extract-overlay"
      role="status"
    >
      <p style={{ fontWeight: 600 }}>
        {t(
          "Harta nu este disponibilă pentru această zonă",
          "Map unavailable for this area",
        )}
      </p>
      <p className="muted small">
        {t(
          "Extracția offline acoperă București și Ilfov.",
          "The offline extract covers Bucharest and Ilfov.",
        )}
      </p>
      <Link href={listHref} className="button">
        {t("Mergi la listă", "Go to list")}
      </Link>
    </div>
  );
}