import { describe, expect, it } from "vitest";
import { initialTourState, tourReducer } from "@/lib/tour/reducer";
import { BUYER_TOUR_STEPS, OWNER_TOUR_STEPS } from "@/lib/tour/steps";

describe("tourReducer", () => {
  it("starts buyer and owner tours", () => {
    const buyer = tourReducer(
      initialTourState,
      { type: "START", tour: "buyer" },
      BUYER_TOUR_STEPS,
    );
    expect(buyer.status).toBe("running");
    expect(buyer.tour).toBe("buyer");
    expect(buyer.stepIndex).toBe(0);

    const owner = tourReducer(
      initialTourState,
      { type: "START", tour: "owner" },
      OWNER_TOUR_STEPS,
    );
    expect(owner.tour).toBe("owner");
  });

  it("advances, goes back, and completes", () => {
    let state = tourReducer(
      initialTourState,
      { type: "START", tour: "buyer" },
      BUYER_TOUR_STEPS,
    );
    state = tourReducer(state, { type: "NEXT" }, BUYER_TOUR_STEPS);
    expect(state.stepIndex).toBe(1);
    state = tourReducer(state, { type: "BACK" }, BUYER_TOUR_STEPS);
    expect(state.stepIndex).toBe(0);
    for (let i = 0; i < BUYER_TOUR_STEPS.length - 1; i += 1) {
      state = tourReducer(state, { type: "NEXT" }, BUYER_TOUR_STEPS);
    }
    state = tourReducer(state, { type: "DONE" }, BUYER_TOUR_STEPS);
    expect(state.status).toBe("completed");
  });

  it("marks target missing without advancing", () => {
    let state = tourReducer(
      initialTourState,
      { type: "START", tour: "buyer" },
      BUYER_TOUR_STEPS,
    );
    state = tourReducer(state, { type: "TARGET_MISSING" }, BUYER_TOUR_STEPS);
    expect(state.targetMissing).toBe(true);
    expect(state.stepIndex).toBe(0);
  });

  it("skips to idle and tracks dont-show", () => {
    let state = tourReducer(
      initialTourState,
      { type: "START", tour: "buyer" },
      BUYER_TOUR_STEPS,
    );
    state = tourReducer(state, { type: "SET_DONT_SHOW", value: true }, BUYER_TOUR_STEPS);
    state = tourReducer(state, { type: "NEXT" }, BUYER_TOUR_STEPS);
    state = tourReducer(state, { type: "SKIP" }, BUYER_TOUR_STEPS);
    expect(state.status).toBe("idle");
    expect(state.dontShowAgain).toBe(true);
    expect(state.stepIndex).toBe(1);
  });
});
