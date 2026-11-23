import { OPTIONAL_CONTENT_STORAGE_KEY } from "@/lib/optional-content";
import { TOUR_HEADER_MENU_MIN_WIDTH, TOUR_MOBILE_MAX_WIDTH } from "./constants";
import type { TourStepDefinition } from "./types";
import { selectorForTourTarget } from "./wait-for-target";

function mapTilesAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(OPTIONAL_CONTENT_STORAGE_KEY);
  return stored === "accepted";
}

export function buildTargetSelectors(
  step: TourStepDefinition,
  pathname: string,
): string[] {
  const selectors: string[] = [];
  const mobile = window.innerWidth <= TOUR_MOBILE_MAX_WIDTH;
  const desktopNavHidden = window.innerWidth < TOUR_HEADER_MENU_MIN_WIDTH;

  if (step.id === "B5" && desktopNavHidden) {
    selectors.push(".mobile-menu");
    selectors.push('[data-testid="nav-map-link-mobile"]');
    selectors.push(selectorForTourTarget(step.target));
    return selectors;
  }

  if (step.id === "B6") {
    const consent = mapTilesAllowed();
    if (!consent) {
      selectors.push(selectorForTourTarget("map-consent-accept"));
      selectors.push('[data-testid="listings-map-accept"]');
    } else {
      selectors.push(selectorForTourTarget("map-surface"));
      if (mobile) {
        selectors.push('[data-testid="listings-map-mobile-toggle"]');
      }
    }
    for (const fb of step.fallbackTargets ?? []) {
      selectors.push(selectorForTourTarget(fb));
    }
    return selectors;
  }

  selectors.push(selectorForTourTarget(step.target));
  for (const fb of step.fallbackTargets ?? []) {
    selectors.push(selectorForTourTarget(fb));
  }

  if (step.id === "B6" && mobile && pathname.startsWith("/map")) {
    selectors.push('[data-testid="listings-map-mobile-toggle"]');
  }

  return Array.from(new Set(selectors));
}

export function bodyForStep(
  step: TourStepDefinition,
  language: "ro" | "en",
): string {
  const noConsent =
    step.id === "B6" && !mapTilesAllowed() && step.bodyRoNoConsent;
  if (noConsent) {
    return language === "ro"
      ? step.bodyRoNoConsent!
      : step.bodyEnNoConsent ?? step.bodyEn;
  }
  return language === "ro" ? step.bodyRo : step.bodyEn;
}
