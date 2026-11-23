import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/safe-browser-storage";
import type { TourKind } from "./types";

export const TOUR_STORAGE_KEY = "licitatiero-tour";
export const TOUR_STORAGE_VERSION = 1;

export type TourResumeState = {
  tour: TourKind;
  step: number;
};

export type TourPersistedV1 = {
  v: 1;
  dismissed: boolean;
  completed: TourKind[];
  resume: TourResumeState | null;
};

export const emptyTourStorage = (): TourPersistedV1 => ({
  v: TOUR_STORAGE_VERSION,
  dismissed: false,
  completed: [],
  resume: null,
});

export function readTourStorage(): TourPersistedV1 {
  try {
    const raw = safeLocalStorageGetItem(TOUR_STORAGE_KEY);
    if (!raw) return emptyTourStorage();
    const parsed = JSON.parse(raw) as Partial<TourPersistedV1>;
    if (parsed.v !== TOUR_STORAGE_VERSION) return emptyTourStorage();
    return {
      v: 1,
      dismissed: Boolean(parsed.dismissed),
      completed: Array.isArray(parsed.completed)
        ? parsed.completed.filter((t): t is TourKind => t === "buyer" || t === "owner")
        : [],
      resume:
        parsed.resume &&
        (parsed.resume.tour === "buyer" || parsed.resume.tour === "owner") &&
        typeof parsed.resume.step === "number"
          ? { tour: parsed.resume.tour, step: parsed.resume.step }
          : null,
    };
  } catch {
    return emptyTourStorage();
  }
}

export function writeTourStorage(next: TourPersistedV1): void {
  safeLocalStorageSetItem(TOUR_STORAGE_KEY, JSON.stringify(next));
}

export function mergeTourStorage(
  patch: Partial<Omit<TourPersistedV1, "v">>,
): TourPersistedV1 {
  const current = readTourStorage();
  const merged: TourPersistedV1 = {
    ...current,
    ...patch,
    v: TOUR_STORAGE_VERSION,
    completed: patch.completed ?? current.completed,
    resume: patch.resume === undefined ? current.resume : patch.resume,
  };
  writeTourStorage(merged);
  return merged;
}

export function markTourCompleted(tour: TourKind): TourPersistedV1 {
  const current = readTourStorage();
  const completed = current.completed.includes(tour)
    ? current.completed
    : [...current.completed, tour];
  return mergeTourStorage({ completed, resume: null });
}

export function setTourResume(tour: TourKind, step: number): TourPersistedV1 {
  return mergeTourStorage({ resume: { tour, step } });
}

export function clearTourResume(): TourPersistedV1 {
  return mergeTourStorage({ resume: null });
}
