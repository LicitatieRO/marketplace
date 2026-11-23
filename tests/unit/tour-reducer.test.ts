import { describe, expect, it } from "vitest";
import {
  initialTourState,
  tourReducer,
} from "@/lib/tour/reducer";
import { ACTIVE_TOUR_STEPS } from "@/lib/tour/steps";

const steps = ACTIVE_TOUR_STEPS;

describe("product tour reducer", () => {
  it("starts at the requested step", () => {
    const next = tourReducer(initialTourState, { type: "START" }, steps);
    expect(next.status).toBe("running");
    expect(next.stepIndex).toBe(0);
    expect(next.resumeOffer).toBe(false);
  });

  it("advances on next and completes on the last step", () => {
    let state = tourReducer(initialTourState, { type: "START" }, steps);
    for (let index = 0; index < steps.length - 1; index += 1) {
      state = tourReducer(state, { type: "NEXT" }, steps);
      expect(state.stepIndex).toBe(index + 1);
    }
    state = tourReducer(state, { type: "NEXT" }, steps);
    expect(state.status).toBe("completed");
    expect(state.stepIndex).toBe(steps.length - 1);
  });

  it("moves back when not on the first step", () => {
    let state = tourReducer(initialTourState, { type: "START" }, steps);
    state = tourReducer(state, { type: "NEXT" }, steps);
    state = tourReducer(state, { type: "BACK" }, steps);
    expect(state.stepIndex).toBe(0);
    state = tourReducer(state, { type: "BACK" }, steps);
    expect(state.stepIndex).toBe(0);
  });

  it("skips and offers resume when mid-tour", () => {
    let state = tourReducer(initialTourState, { type: "START" }, steps);
    state = tourReducer(state, { type: "NEXT" }, steps);
    state = tourReducer(state, { type: "SKIP" }, steps);
    expect(state.status).toBe("idle");
    expect(state.stepIndex).toBe(1);
    expect(state.resumeOffer).toBe(true);
  });

  it("hydrates resume offer from persistence", () => {
    const state = tourReducer(
      initialTourState,
      { type: "HYDRATE_RESUME", stepIndex: 2 },
      steps,
    );
    expect(state.status).toBe("idle");
    expect(state.stepIndex).toBe(2);
    expect(state.resumeOffer).toBe(true);
  });

  it("skips missing-selector steps like next", () => {
    let state = tourReducer(initialTourState, { type: "START" }, steps);
    state = tourReducer(state, { type: "SKIP_STEP_MISSING" }, steps);
    expect(state.status).toBe("running");
    expect(state.stepIndex).toBe(1);
  });
});