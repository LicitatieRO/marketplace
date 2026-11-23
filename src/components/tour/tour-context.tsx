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
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { usePlatform } from "@/components/platform";
import { tourUi, translate } from "@/lib/i18n";
import { TOUR_MOBILE_MAX_WIDTH } from "@/lib/tour/constants";
import { hasOwnerTourSession } from "@/lib/tour/owner-session";
import {
  initialTourState,
  tourReducer,
  type TourState,
} from "@/lib/tour/reducer";
import { bodyForStep, buildTargetSelectors } from "@/lib/tour/resolve-targets";
import {
  BUYER_TOUR_STEPS,
  OWNER_TOUR_STEPS,
  stepsForTour,
} from "@/lib/tour/steps";
import {
  clearTourResume,
  markTourCompleted,
  mergeTourStorage,
  readTourStorage,
  setTourResume,
} from "@/lib/tour/storage";
import type { TourKind, TourStepDefinition, TourStepPlacement } from "@/lib/tour/types";
import { selectorForTourTarget, waitForTarget } from "@/lib/tour/wait-for-target";

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TourContextValue = {
  startTour: (tour: TourKind, stepIndex?: number) => void;
  resumeTour: () => void;
  forceOff: () => void;
  storage: ReturnType<typeof readTourStorage>;
  entryLabel: string;
  running: boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useProductTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("Tour provider missing");
  return ctx;
}

function currentLocationPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

function routeMatches(stepRoute: string | undefined, location: string): boolean {
  if (!stepRoute) return true;
  const [stepPath, stepQuery] = stepRoute.split("?");
  const [locPath, locQuery = ""] = location.split("?");
  if (stepPath !== locPath) return false;
  if (!stepQuery) return true;
  const want = new URLSearchParams(stepQuery);
  const have = new URLSearchParams(locQuery);
  for (const [key, value] of want.entries()) {
    if (have.get(key) !== value) return false;
  }
  return true;
}

function placementForStep(
  step: TourStepDefinition,
  mobile: boolean,
): TourStepPlacement | "sheet" {
  if (mobile && step.mobilePlacement) return step.mobilePlacement;
  if (!mobile && step.desktopPlacement) return step.desktopPlacement;
  return step.placement;
}

function desktopTooltipStyle(
  placement: TourStepPlacement,
  rect: SpotlightRect,
): React.CSSProperties {
  const margin = 12;
  const dialogWidth = 320;
  const dialogHeight = 200;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.top + rect.height + margin;
  let left = rect.left;
  if (placement === "top") {
    top = rect.top - dialogHeight - margin;
  } else if (placement === "left") {
    top = rect.top;
    left = rect.left - dialogWidth - margin;
  } else if (placement === "right") {
    top = rect.top;
    left = rect.left + rect.width + margin;
  } else if (placement === "center") {
    top = vh / 2 - dialogHeight / 2;
    left = vw / 2 - dialogWidth / 2;
    return { top, left };
  }
  left = Math.min(Math.max(8, left), vw - dialogWidth - 8);
  top = Math.min(Math.max(8, top), vh - dialogHeight - 8);
  if (top + dialogHeight > vh - 8) {
    top = Math.max(8, vh / 2 - dialogHeight / 2);
    left = vw / 2 - dialogWidth / 2;
  }
  return { top, left };
}

function clipPathForRect(rect: SpotlightRect | null): string | undefined {
  if (!rect) return undefined;
  const pad = 6;
  const t = Math.max(0, rect.top - pad);
  const l = Math.max(0, rect.left - pad);
  const r = l + rect.width + pad * 2;
  const b = t + rect.height + pad * 2;
  return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px ${t}px)`;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { language, t, viewer } = usePlatform();
  const router = useRouter();
  const pathname = usePathname();
  const mounted = typeof window !== "undefined";
  const [storage, setStorage] = useState(() => readTourStorage());
  const [state, dispatch] = useReducer(
    (prev: TourState, action: Parameters<typeof tourReducer>[1]) => {
      const tour =
        action.type === "START"
          ? action.tour
          : action.type === "RESUME"
            ? action.tour
            : prev.tour;
      return tourReducer(prev, action, stepsForTour(tour));
    },
    initialTourState,
  );
  const steps = useMemo(() => stepsForTour(state.tour), [state.tour]);
  const step = steps[state.stepIndex];
  const running = state.status === "running";
  const total = steps.length;
  const isFirst = state.stepIndex <= 0;
  const isLast = state.stepIndex >= total - 1;
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const navKeyRef = useRef<string | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const refreshStorage = useCallback(() => {
    setStorage(readTourStorage());
  }, []);

  const stripTourQuery = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("tour")) return;
    url.searchParams.delete("tour");
    const next = `${url.pathname}${url.search}${url.hash}`;
    router.replace(next);
  }, [router]);

  const persistSkip = useCallback(() => {
    if (state.status !== "running") return;
    const saved = setTourResume(state.tour, state.stepIndex);
    setStorage(saved);
    refreshStorage();
    if (state.dontShowAgain) {
      const dismissed = mergeTourStorage({ dismissed: true });
      setStorage(dismissed);
      refreshStorage();
    }
  }, [refreshStorage, state.dontShowAgain, state.status, state.stepIndex, state.tour]);

  const persistDone = useCallback(() => {
    const saved = markTourCompleted(state.tour);
    setStorage(saved);
    refreshStorage();
    if (state.tour === "owner") {
      setToast(translate(language, ...tourUi.ownerDoneToast));
      window.setTimeout(() => setToast(null), 2500);
    }
  }, [language, refreshStorage, state.tour]);

  const startTour = useCallback(
    (tour: TourKind, stepIndex = 0) => {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      clearTourResume();
      refreshStorage();
      dispatch({ type: "START", tour, stepIndex });
    },
    [refreshStorage],
  );

  const resumeTour = useCallback(() => {
    const saved = readTourStorage();
    if (!saved.resume) return;
    dispatch({
      type: "RESUME",
      tour: saved.resume.tour,
      stepIndex: saved.resume.step,
    });
  }, []);

  const endTour = useCallback(() => {
    persistSkip();
    dispatch({ type: "SKIP" });
    setTargetRect(null);
    returnFocusRef.current?.focus();
    stripTourQuery();
  }, [persistSkip, stripTourQuery]);

  const finishTour = useCallback(() => {
    persistDone();
    dispatch({ type: "DONE" });
    setTargetRect(null);
    returnFocusRef.current?.focus();
    stripTourQuery();
  }, [persistDone, stripTourQuery]);

  const entryLabel = useMemo(() => {
    const resume = storage.resume;
    if (resume) {
      const totalFor = resume.tour === "buyer" ? BUYER_TOUR_STEPS.length : OWNER_TOUR_STEPS.length;
      return translate(language, ...tourUi.resumeTour(resume.step + 1, totalFor));
    }
    return translate(language, ...tourUi.takeTour);
  }, [language, storage.resume]);

  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqMobile = window.matchMedia(`(max-width: ${TOUR_MOBILE_MAX_WIDTH}px)`);
    const apply = () => {
      setReducedMotion(mqMotion.matches);
      setMobile(mqMobile.matches);
    };
    apply();
    mqMotion.addEventListener("change", apply);
    mqMobile.addEventListener("change", apply);
    return () => {
      mqMotion.removeEventListener("change", apply);
      mqMobile.removeEventListener("change", apply);
    };
  }, []);

  const measureTarget = useCallback(
    (element: Element) => {
      const scrollBehavior = reducedMotion ? "auto" : "smooth";
      element.scrollIntoView({ block: "center", behavior: scrollBehavior });
      const measure = () => {
        const box = element.getBoundingClientRect();
        setTargetRect({
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
        });
      };
      if (reducedMotion) measure();
      else window.requestAnimationFrame(measure);
    },
    [reducedMotion],
  );

  const advanceStep = useCallback(() => {
    if (isLast) finishTour();
    else dispatch({ type: "NEXT" });
  }, [finishTour, isLast]);

  useEffect(() => {
    if (!running || !step) {
      startTransition(() => {
        setTargetRect(null);
        setWaiting(false);
      });
      return;
    }
    let cancelled = false;
    startTransition(() => setWaiting(true));

    void (async () => {
      if (step.requiresOwnerSession && !hasOwnerTourSession(viewer)) {
        if (state.stepIndex > 0) {
          dispatch({ type: "RESUME", tour: "owner", stepIndex: 0 });
          return;
        }
      }

      const location = currentLocationPath();
      if (step.route && !routeMatches(step.route, location)) {
        const navKey = `${step.route}:${state.stepIndex}`;
        if (navKeyRef.current !== navKey) {
          navKeyRef.current = navKey;
          router.push(step.route);
          return;
        }
      } else {
        navKeyRef.current = null;
      }

      const selectors = buildTargetSelectors(step, pathname);
      const result = await waitForTarget(selectors);
      if (cancelled) return;
      startTransition(() => setWaiting(false));
      if (!result.ok) {
        dispatch({ type: "TARGET_MISSING" });
        setTargetRect(null);
        return;
      }
      dispatch({ type: "TARGET_FOUND" });
      measureTarget(result.element);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    running,
    step,
    pathname,
    router,
    state.stepIndex,
    viewer,
    measureTarget,
  ]);

  useEffect(() => {
    if (!running || !step || state.targetMissing) return;
    const selectors = buildTargetSelectors(step, pathname);
    const onResize = () => {
      for (const sel of selectors) {
        const el = document.querySelector(selectorForTourTarget(sel));
        if (el) measureTarget(el);
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [running, step, pathname, state.targetMissing, measureTarget]);

  useEffect(() => {
    if (!running || !step || step.action !== "required" || state.targetMissing) {
      return;
    }
    const selectors = buildTargetSelectors(step, pathname);
    let cleaned: (() => void) | null = null;
    void waitForTarget(selectors).then((result) => {
      if (!result.ok) return;
      const el = result.element;
      const onActivate = () => {
        window.setTimeout(() => advanceStep(), 80);
      };
      el.addEventListener("click", onActivate, { capture: true });
      cleaned = () => el.removeEventListener("click", onActivate, { capture: true });
    });
    return () => cleaned?.();
  }, [advanceStep, pathname, running, state.targetMissing, step]);

  useLayoutEffect(() => {
    if (!running) return;
    titleRef.current?.focus();
  }, [running, state.stepIndex, targetRect, state.targetMissing]);

  const onPrimary = useCallback(() => {
    if (!step) return;
    if (state.targetMissing) {
      advanceStep();
      return;
    }
    if (step.action === "required" && step.advanceRoute) {
      router.push(step.advanceRoute);
      return;
    }
    advanceStep();
  }, [advanceStep, router, state.targetMissing, step]);

  useEffect(() => {
    if (!running) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        endTour();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        onPrimary();
        return;
      }
      if (event.key === "ArrowLeft" && !isFirst) {
        event.preventDefault();
        dispatch({ type: "BACK" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, endTour, isFirst, onPrimary, running]);

  useEffect(() => {
    if (!running || !step) return;
    const title = t(step.titleRo, step.titleEn);
    if (liveRef.current) {
      liveRef.current.textContent = translate(
        language,
        ...tourUi.progressLive(state.stepIndex + 1, total, title),
      );
    }
  }, [language, running, state.stepIndex, step, t, total]);

  const sheetMode =
    mobile && step && placementForStep(step, true) === "sheet" && !state.targetMissing;
  const centeredMissing = state.targetMissing;
  const placement =
    step && !centeredMissing
      ? placementForStep(step, mobile)
      : ("center" as const);

  const forceOff = useCallback(() => {
    dispatch({ type: "FORCE_IDLE" });
    setTargetRect(null);
  }, []);

  const contextValue: TourContextValue = {
    startTour,
    resumeTour,
    forceOff,
    storage,
    entryLabel,
    running,
  };

  const overlay =
    mounted && running && step ? (
      <div
        className={`tour-root${reducedMotion ? " tour-root--static" : ""}`}
        data-testid="product-tour-root"
      >
        <div
          className="tour-backdrop"
          style={{ clipPath: centeredMissing ? undefined : clipPathForRect(targetRect) }}
          aria-hidden="true"
          onClick={endTour}
        />
        {targetRect && !centeredMissing ? (
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
          className={`tour-dialog${sheetMode ? " tour-dialog--sheet" : ""}${centeredMissing ? " tour-dialog--center" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-dialog-title"
          aria-describedby="tour-dialog-body"
          tabIndex={-1}
          data-testid="tour-dialog"
          style={
            sheetMode || centeredMissing
              ? undefined
              : placement !== "sheet"
                ? desktopTooltipStyle(placement as TourStepPlacement, targetRect ?? { top: 80, left: 24, width: 0, height: 0 })
                : undefined
          }
        >
          {sheetMode ? <div className="tour-sheet-handle" aria-hidden="true" /> : null}
          <div className="tour-progress-row">
            <span className="tour-step-label" id="tour-dialog-step">
              {translate(language, ...tourUi.progress(state.stepIndex + 1, total))}
            </span>
            <div className="tour-dot-bar" aria-hidden="true">
              {steps.map((dot, index) => (
                <span
                  key={dot.id}
                  className={
                    index === state.stepIndex
                      ? "is-active"
                      : index < state.stepIndex
                        ? "is-done"
                        : ""
                  }
                />
              ))}
            </div>
          </div>
          <h2 id="tour-dialog-title" ref={titleRef} tabIndex={-1}>
            {centeredMissing
              ? translate(language, ...tourUi.targetMissing)
              : t(step.titleRo, step.titleEn)}
          </h2>
          <p id="tour-dialog-body" className="tour-dialog-body">
            {waiting
              ? translate(language, ...tourUi.loadingStep)
              : centeredMissing
                ? ""
                : bodyForStep(step, language)}
          </p>
          {isFirst && !centeredMissing ? (
            <label className="tour-dismiss-check">
              <input
                type="checkbox"
                checked={state.dontShowAgain}
                onChange={(event) =>
                  dispatch({ type: "SET_DONT_SHOW", value: event.target.checked })
                }
              />
              {translate(language, ...tourUi.dontShowAgain)}
            </label>
          ) : null}
          <div className="tour-dialog-actions">
            <button
              type="button"
              className="tour-link-button"
              data-testid="tour-skip"
              onClick={endTour}
            >
              {translate(language, ...tourUi.skipTour)}
            </button>
            <div className="tour-dialog-actions-main">
              {!isFirst ? (
                <button
                  type="button"
                  className="button"
                  data-testid="tour-back"
                  onClick={() => dispatch({ type: "BACK" })}
                >
                  {translate(language, ...tourUi.back)}
                </button>
              ) : null}
              {step.action === "required" && !centeredMissing ? (
                <span className="tour-required-hint" data-testid="tour-required-hint">
                  {translate(language, ...tourUi.requiredHint)}
                </span>
              ) : null}
              {(step.action !== "required" ||
                centeredMissing ||
                Boolean(step.advanceRoute)) && (
                <button
                  type="button"
                  className="button primary"
                  data-testid="tour-next"
                  disabled={waiting && !centeredMissing && !targetRect}
                  onClick={onPrimary}
                >
                  {centeredMissing
                    ? translate(language, ...tourUi.skipStep)
                    : isLast
                      ? translate(language, ...tourUi.done)
                      : translate(language, ...tourUi.next)}
                </button>
              )}
            </div>
          </div>
          {isLast && step.handoffOwnerTour ? (
            <button
              type="button"
              className="button tour-owner-handoff"
              data-testid="tour-owner-handoff"
              onClick={() => startTour("owner", 0)}
            >
              {translate(language, ...tourUi.ownerHandoff)}
            </button>
          ) : null}
          <button
            type="button"
            className="tour-close"
            data-testid="tour-close"
            aria-label={translate(language, ...tourUi.closeTour)}
            onClick={endTour}
          >
            ×
          </button>
        </div>
        <div ref={liveRef} className="sr-only" aria-live="polite" />
      </div>
    ) : null;

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {mounted ? createPortal(overlay, document.body) : null}
      {toast ? (
        <div className="tour-toast" role="status">
          {toast}
        </div>
      ) : null}
      <TourAutoOfferChip />
    </TourContext.Provider>
  );
}

function TourAutoOfferChip() {
  const { language, viewer } = usePlatform();
  const { startTour, storage, running } = useProductTour();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (running || viewer || storage.dismissed || storage.resume) return;
    const onHome = window.location.pathname === "/";
    if (!onHome) return;
    const timer = window.setTimeout(() => setVisible(true), 4000);
    return () => window.clearTimeout(timer);
  }, [running, storage.dismissed, storage.resume, viewer]);
  if (!visible) return null;
  return (
    <div className="tour-auto-chip page-width" role="status">
      <span>{translate(language, ...tourUi.autoOffer)}</span>
      <button
        type="button"
        className="button primary"
        data-testid="tour-auto-offer"
        onClick={() => {
          setVisible(false);
          startTour("buyer", 0);
        }}
      >
        {translate(language, ...tourUi.takeTour)}
      </button>
      <button
        type="button"
        className="text-button"
        data-testid="tour-auto-dismiss"
        onClick={() => setVisible(false)}
      >
        {translate(language, ...tourUi.closeTour)}
      </button>
    </div>
  );
}
