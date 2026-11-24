import type { TourKind, TourStepDefinition } from "./types";

export type TourRunStatus = "idle" | "running" | "completed";

export type TourState = {
  status: TourRunStatus;
  tour: TourKind;
  stepIndex: number;
  targetMissing: boolean;
  dontShowAgain: boolean;
};

export type TourAction =
  | { type: "START"; tour: TourKind; stepIndex?: number }
  | { type: "RESUME"; tour: TourKind; stepIndex: number }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SKIP" }
  | { type: "DONE" }
  | { type: "TARGET_MISSING" }
  | { type: "TARGET_FOUND" }
  | { type: "FORCE_IDLE" }
  | { type: "SET_DONT_SHOW"; value: boolean };

export const initialTourState: TourState = {
  status: "idle",
  tour: "buyer",
  stepIndex: 0,
  targetMissing: false,
  dontShowAgain: false,
};

export function clampStepIndex(
  index: number,
  steps: TourStepDefinition[],
): number {
  if (steps.length === 0) return 0;
  return Math.min(Math.max(0, index), steps.length - 1);
}

export function tourReducer(
  state: TourState,
  action: TourAction,
  steps: TourStepDefinition[],
): TourState {
  const last = Math.max(0, steps.length - 1);
  switch (action.type) {
    case "START":
      return {
        status: "running",
        tour: action.tour,
        stepIndex: clampStepIndex(action.stepIndex ?? 0, steps),
        targetMissing: false,
        dontShowAgain: false,
      };
    case "RESUME":
      return {
        status: "running",
        tour: action.tour,
        stepIndex: clampStepIndex(action.stepIndex, steps),
        targetMissing: false,
        dontShowAgain: false,
      };
    case "NEXT": {
      if (state.status !== "running") return state;
      if (state.stepIndex >= last) {
        return { ...state, status: "completed", targetMissing: false };
      }
      return {
        ...state,
        stepIndex: state.stepIndex + 1,
        targetMissing: false,
      };
    }
    case "TARGET_MISSING":
      return state.status === "running"
        ? { ...state, targetMissing: true }
        : state;
    case "TARGET_FOUND":
      return { ...state, targetMissing: false };
    case "SKIP":
      return {
        ...state,
        status: "idle",
        targetMissing: false,
      };
    case "DONE":
      return {
        ...state,
        status: "completed",
        targetMissing: false,
      };
    case "BACK": {
      if (state.status !== "running" || state.stepIndex <= 0) return state;
      return {
        ...state,
        stepIndex: state.stepIndex - 1,
        targetMissing: false,
      };
    }
    case "FORCE_IDLE":
      return { ...state, status: "idle", targetMissing: false };
    case "SET_DONT_SHOW":
      return { ...state, dontShowAgain: action.value };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
