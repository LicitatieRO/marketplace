"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlatform } from "@/components/platform";
import { tourUi, translate } from "@/lib/i18n";
import {
  initialTourState,
  persistenceFromTourState,
  tourReducer,
  type TourState,
} from "@/lib/tour/reducer";
import { TOUR_START_EVENT } from "@/lib/tour/events";
import { ACTIVE_TOUR_STEPS } from "@/lib/tour/steps";
import {
  TOUR_VERSION,
  clearTourPersistence,
  readTourPersistence,
  writeTourPersistence,
} from "@/lib/tour/storage";
import type { TourStepDefinition, TourStepPlacement } from "@/lib/tour/types";
import { waitForSelector } from "@/lib/tour/wait-for-selector";

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TourContextValue = {
  startTour: (fromStep?: number) => void;
  resumeTour: () => void;
  state: TourState;
  resumeOffer: boolean;
  takeTourLabel: string;
  resumeTourLabel: string;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useProductTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("Tour provider missing");
  return ctx;
}

function placementStyle(
  placement: TourStepPlacement,
  rect: SpotlightRect,
  dialogWidth: number,
  dialogHeight: number,
): { top: number; left: number } {
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.top + rect.height + margin;
  let left = rect.left;
  if (placement === "top") {
    top = rect.top - dialogHeight - margin;
    left = rect.left;
  } else if (placement === "left") {
    top = rect.top;
    left = rect.left - dialogWidth - margin;
  } else if (placement === "right") {
    top = rect.top;
    left = rect.left + rect.width + margin;
  } else if (placement === "center") {
    return { top: vh / 2 - dialogHeight / 2, left: vw / 2 - dialogWidth / 2 };
  }
  left = Math.min(Math.max(8, left), vw - dialogWidth - 8);
  top = Math.min(Math.max(8, top), vh - dialogHeight - 8);
  return { top, left };
}

function syncPersistence(state: TourState) {
  const persisted = persistenceFromTourState(state, ACTIVE_TOUR_STEPS);
  if (!persisted) {
    clearTourPersistence();
    return;
  }
  writeTourPersistence({
    version: TOUR_VERSION,
    stepIndex: persisted.stepIndex,
    inProgress: persisted.inProgress,
  });
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { language, t } = usePlatform();
  const router = useRouter();
  const pathname = usePathname();
  const steps = ACTIVE_TOUR_STEPS;
  const [state, dispatch] = useReducer(
    (prev: TourState, action: Parameters<typeof tourReducer>[1]) =>
      tourReducer(prev, action, steps),
    initialTourState,
  );
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const navigatedRef = useRef<string | null>(null);
  const step: TourStepDefinition | undefined = steps[state.stepIndex];
  const running = state.status === "running";
  const total = steps.length;
  const isFirst = state.stepIndex <= 0;
  const isLast = state.stepIndex >= total - 1;

  const labels = useMemo(
    () => ({
      next: translate(language, ...tourUi.nextStep),
      back: translate(language, ...tourUi.prevStep),
      skip: translate(language, ...tourUi.skipTour),
      close: translate(language, ...tourUi.closeTour),
      resume: translate(language, ...tourUi.resumeTour),
      take: translate(language, ...tourUi.takeTour),
    }),
    [language],
  );

  const startTour = useCallback((fromStep = 0) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dispatch({ type: "START", stepIndex: fromStep });
  }, []);

  const resumeTour = useCallback(() => {
    startTour(state.stepIndex);
  }, [startTour, state.stepIndex]);

  const endTour = useCallback(() => {
    dispatch({ type: "SKIP" });
    setTargetRect(null);
    returnFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const saved = readTourPersistence();
    if (saved?.inProgress && saved.stepIndex > 0) {
      dispatch({ type: "HYDRATE_RESUME", stepIndex: saved.stepIndex });
    }
  }, []);

  useEffect(() => {
    syncPersistence(state);
  }, [state]);

  const measureTarget = useCallback((element: Element) => {
    const box = element.getBoundingClientRect();
    setTargetRect({
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!running || !step) {
      startTransition(() => {
        if (cancelled) return;
        setTargetRect(null);
        setWaiting(false);
      });
      return () => {
        cancelled = true;
      };
    }
    startTransition(() => {
      if (!cancelled) setWaiting(true);
    });
  void (async () => {
      const desiredRoute = step.route;
      if (desiredRoute && pathname !== desiredRoute) {
        const navKey = `${desiredRoute}:${state.stepIndex}`;
        if (navigatedRef.current !== navKey) {
          navigatedRef.current = navKey;
          router.push(desiredRoute);
          return;
        }
      } else {
        navigatedRef.current = null;
      }
      const result = await waitForSelector(step.selector);
      if (cancelled) return;
      startTransition(() => setWaiting(false));
      if (!result.ok) {
        dispatch({ type: "SKIP_STEP_MISSING" });
        return;
      }
      measureTarget(result.element);
    })();
    return () => {
      cancelled = true;
    };
  }, [running, step, pathname, router, state.stepIndex, measureTarget]);

  useEffect(() => {
    if (!running) return;
    const onResize = () => {
      if (!step) return;
      const el = document.querySelector(step.selector);
      if (el) measureTarget(el);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [running, step, measureTarget]);

  useEffect(() => {
    const onStart = () => startTour(0);
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [startTour]);

  useLayoutEffect(() => {
    if (!running || !dialogRef.current) return;
    dialogRef.current.focus();
  }, [running, state.stepIndex, targetRect]);

  useEffect(() => {
    if (!running) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        endTour();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running, endTour]);

  const dialogPosition =
    targetRect && step
      ? placementStyle(step.placement, targetRect, 320, 220)
      : { top: 80, left: 24 };

  const contextValue: TourContextValue = {
    startTour,
    resumeTour,
    state,
    resumeOffer: state.resumeOffer && state.status === "idle",
    takeTourLabel: labels.take,
    resumeTourLabel: labels.resume,
  };

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {state.resumeOffer && state.status === "idle" ? (
        <div className="tour-resume-banner page-width" role="status">
          <button
            type="button"
            className="button primary"
            data-testid="tour-resume"
            onClick={resumeTour}
          >
            {labels.resume}
          </button>
          <button
            type="button"
            className="text-button"
            data-testid="tour-dismiss-resume"
            onClick={() => dispatch({ type: "DISMISS_RESUME" })}
          >
            {labels.close}
          </button>
        </div>
      ) : null}
      {running && step ? (
        <div
          className={`tour-root${reducedMotion ? " tour-root--static" : ""}`}
          data-testid="product-tour-root"
        >
          <div className="tour-backdrop" aria-hidden="true" onClick={endTour} />
          {targetRect ? (
            <div
              className="tour-spotlight"
              style={{
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
              }}
              aria-hidden="true"
            />
          ) : null}
          <div
            ref={dialogRef}
            className="tour-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-dialog-title"
            aria-describedby="tour-dialog-body"
            tabIndex={-1}
            data-testid="tour-dialog"
            style={{
              top: dialogPosition.top,
              left: dialogPosition.left,
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "Enter") {
                event.preventDefault();
                if (isLast) endTour();
                else dispatch({ type: "NEXT" });
              } else if (event.key === "ArrowLeft" && !isFirst) {
                event.preventDefault();
                dispatch({ type: "BACK" });
              }
            }}
          >
            <p className="tour-step-label" id="tour-dialog-step">
              {translate(
                language,
                ...tourUi.stepOf(state.stepIndex + 1, total),
              )}
            </p>
            <h2 id="tour-dialog-title">{t(step.titleRo, step.titleEn)}</h2>
            <p id="tour-dialog-body" className="tour-dialog-body">
              {waiting
                ? translate(language, "Se încarcă pasul…", "Loading step…")
                : t(step.bodyRo, step.bodyEn)}
            </p>
            <div className="tour-dialog-actions">
              <button
                type="button"
                className="text-button"
                data-testid="tour-skip"
                onClick={endTour}
              >
                {labels.skip}
              </button>
              <span className="tour-dialog-actions-spacer" aria-hidden="true" />
              {!isFirst ? (
                <button
                  type="button"
                  className="button"
                  data-testid="tour-back"
                  onClick={() => dispatch({ type: "BACK" })}
                >
                  {labels.back}
                </button>
              ) : null}
              <button
                type="button"
                className="button primary"
                data-testid="tour-next"
                disabled={waiting && !targetRect}
                onClick={() => {
                  if (isLast) endTour();
                  else dispatch({ type: "NEXT" });
                }}
              >
                {isLast ? labels.close : labels.next}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </TourContext.Provider>
  );
}