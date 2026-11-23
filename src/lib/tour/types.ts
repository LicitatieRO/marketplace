export type TourStepPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TourStepId =
  | "catalogue-hero"
  | "catalogue-search"
  | "catalogue-map"
  | "listing-card"
  | "map-page"
  | "listing-price"
  | "listing-bid-panel"
  | "listing-bid-button"
  | "poc-simulation"
  | "account-signin"
  | "poc-role-switch";

export type TourStepDefinition = {
  id: TourStepId;
  selector: `[data-tour="${TourStepId}"]`;
  route?: string;
  titleRo: string;
  titleEn: string;
  bodyRo: string;
  bodyEn: string;
  placement: TourStepPlacement;
};