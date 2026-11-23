import type { TourStepDefinition } from "./types";

export type TourRunStatus = "idle" | "running" | "completed";

export type TourState = {
  status: TourRunStatus;
  stepIndex: number;
  resumeOffer: boolean;
};

export type TourAction =
  | { type: "START"; stepIndex?: number }
  | { type: "RESUME" }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SKIP" }
  | { type: "SKIP_STEP_MISSING" }
  | { type: "DISMISS_RESUME" }
  | { type: "HYDRATE_RESUME"; stepIndex: number };

export const initialTourState: TourState = {
  status: "idle",
  stepIndex: 0,
  resumeOffer: false,
};

export function tourStepCount(steps: TourStepDefinition[]): number {
  return steps.length;
}

export function clampStepIndex(index: number, steps: TourStepDefinition[]): number {
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
        stepIndex: clampStepIndex(action.stepIndex ?? 0, steps),
        resumeOffer: false,
      };
    case "RESUME":
      return {
        status: "running",
        stepIndex: clampStepIndex(state.stepIndex, steps),
        resumeOffer: false,
      };
    case "NEXT": {
      if (state.status !== "running") return state;
      if (state.stepIndex >= last) {
        return { status: "completed", stepIndex: last, resumeOffer: false };
      }
      return { ...state, stepIndex: state.stepIndex + 1 };
    }
    case "SKIP_STEP_MISSING": {
      if (state.status !== "running") return state;
      if (state.stepIndex >= last) {
        return { status: "completed", stepIndex: last, resumeOffer: false };
      }
      return { ...state, stepIndex: state.stepIndex + 1 };
    }
    case "BACK": {
      if (state.status !== "running" || state.stepIndex <= 0) return state;
      return { ...state, stepIndex: state.stepIndex - 1 };
    }
    case "SKIP":
      return {
        status: "idle",
        stepIndex: state.stepIndex,
        resumeOffer: state.stepIndex > 0 && state.stepIndex < steps.length,
      };
    case "DISMISS_RESUME":
      return { ...state, resumeOffer: false };
    case "HYDRATE_RESUME":
      return {
        status: "idle",
        stepIndex: clampStepIndex(action.stepIndex, steps),
        resumeOffer: action.stepIndex > 0,
      };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function persistenceFromTourState(
  state: TourState,
  steps: TourStepDefinition[],
): { stepIndex: number; inProgress: boolean } | null {
  if (state.status === "completed") {
    return null;
  }
  if (state.status === "running") {
    return { stepIndex: state.stepIndex, inProgress: true };
  }
  if (state.resumeOffer && state.stepIndex > 0 && state.stepIndex < steps.length) {
    return { stepIndex: state.stepIndex, inProgress: true };
  }
  return null;
}