import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOUR_STORAGE_KEY,
  emptyTourStorage,
  markTourCompleted,
  mergeTourStorage,
  readTourStorage,
  setTourResume,
} from "@/lib/tour/storage";

describe("tour storage v1", () => {
  const bag: Record<string, string> = {};
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => bag[key] ?? null,
      setItem: (key: string, value: string) => {
        bag[key] = value;
      },
      removeItem: (key: string) => {
        delete bag[key];
      },
      clear: () => {
        for (const key of Object.keys(bag)) delete bag[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of Object.keys(bag)) delete bag[key];
  });

  it("reads empty defaults", () => {
    expect(readTourStorage()).toEqual(emptyTourStorage());
  });

  it("persists resume and completed tours", () => {
    setTourResume("buyer", 3);
    expect(readTourStorage().resume).toEqual({ tour: "buyer", step: 3 });
    const done = markTourCompleted("buyer");
    expect(done.completed).toContain("buyer");
    expect(done.resume).toBeNull();
  });

  it("stores dismissed flag", () => {
    mergeTourStorage({ dismissed: true });
    expect(readTourStorage().dismissed).toBe(true);
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toContain('"dismissed":true');
  });
});