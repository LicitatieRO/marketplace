export type TourKind = "buyer" | "owner";

export type TourStepPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TourStepAction = "required" | "optional";

export type TourDataTourTarget =
  | "hero"
  | "poc-banner"
  | "catalogue-search"
  | "listing-card"
  | "nav-map"
  | "map-surface"
  | "map-consent-accept"
  | "map-card-bid"
  | "offer-panel"
  | "account-entry"
  | "persona-switcher"
  | "workspace-owner-tab"
  | "owner-add-property"
  | "wizard-dual-price"
  | "promo-panel"
  | "owner-offers";

export type TourStepDefinition = {
  id: string;
  tour: TourKind;
  route?: string;
  target: TourDataTourTarget;
  /** Alternate data-tour or data-testid selectors, tried in order after primary. */
  fallbackTargets?: string[];
  titleRo: string;
  titleEn: string;
  bodyRo: string;
  bodyEn: string;
  bodyRoNoConsent?: string;
  bodyEnNoConsent?: string;
  placement: TourStepPlacement;
  desktopPlacement?: TourStepPlacement;
  mobilePlacement?: TourStepPlacement | "sheet";
  action: TourStepAction;
  /** Next may navigate here when the step is optional (e.g. B5). */
  advanceRoute?: string;
  requiresOwnerSession?: boolean;
  /** B9: secondary CTA to start the owner tour. */
  handoffOwnerTour?: boolean;
};
