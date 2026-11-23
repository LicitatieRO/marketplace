export const TOUR_STORAGE_KEY = "licitatiero-product-tour";
export const TOUR_VERSION = 1;

export type TourPersistedState = {
  version: number;
  stepIndex: number;
  inProgress: boolean;
};

export function readTourPersistence(): TourPersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TourPersistedState;
    if (parsed.version !== TOUR_VERSION) return null;
    if (
      typeof parsed.stepIndex !== "number" ||
      typeof parsed.inProgress !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeTourPersistence(state: TourPersistedState): void {
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
}

export function clearTourPersistence(): void {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}