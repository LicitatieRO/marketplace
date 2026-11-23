const DEFAULT_TIMEOUT_MS = 12_000;
const POLL_MS = 80;

export type WaitForSelectorResult =
  | { ok: true; element: Element }
  | { ok: false; reason: "timeout" | "missing" };

export function waitForSelector(
  selector: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<WaitForSelectorResult> {
  if (typeof document === "undefined") {
    return Promise.resolve({ ok: false, reason: "missing" });
  }
  const existing = document.querySelector(selector);
  if (existing) {
    return Promise.resolve({ ok: true, element: existing });
  }
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) {
        resolve({ ok: true, element: el });
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve({ ok: false, reason: "timeout" });
        return;
      }
      window.setTimeout(tick, POLL_MS);
    };
    tick();
  });
}