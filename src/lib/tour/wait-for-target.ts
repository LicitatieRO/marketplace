import { TOUR_TARGET_WAIT_MS } from "./constants";

const tourSelector = (target: string): string => `[data-tour="${target}"]`;

export function selectorForTourTarget(target: string): string {
  const trimmed = target.trim();
  if (
    trimmed.startsWith("[") ||
    trimmed.startsWith(".") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("data-tour=")) {
    return `[${trimmed}]`;
  }
  return tourSelector(trimmed);
}

export type WaitForTargetResult =
  | { ok: true; element: Element; selector: string }
  | { ok: false; reason: "timeout" | "missing" };

export function waitForTarget(
  selectors: string[],
  timeoutMs: number = TOUR_TARGET_WAIT_MS,
): Promise<WaitForTargetResult> {
  if (typeof document === "undefined") {
    return Promise.resolve({ ok: false, reason: "missing" });
  }

  const tryFind = (): { element: Element; selector: string } | null => {
    for (const raw of selectors) {
      const sel = selectorForTourTarget(raw);
      const el = document.querySelector(sel);
      if (el) return { element: el, selector: sel };
    }
    return null;
  };

  const hit = tryFind();
  if (hit) {
    return Promise.resolve({ ok: true, ...hit });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: WaitForTargetResult) => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      resolve(result);
    };

    const tick = () => {
      const found = tryFind();
      if (found) {
        finish({ ok: true, ...found });
      }
    };

    const observer = new MutationObserver(tick);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const interval = window.setInterval(tick, 120);
    const timeout = window.setTimeout(
      () => finish({ ok: false, reason: "timeout" }),
      timeoutMs,
    );
    tick();
  });
}
