"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { usePlatform } from "@/components/platform";
import { demoSwitcherChipLabel } from "@/lib/i18n";

const DEMO_PERSONA_KEY = "licitatiero-demo-persona";
const DUAL_GUEST_VIEW_KEY = "licitatiero-dual-guest-view";
export type PocPersona = "guest" | "owner" | "buyer" | "dual";
export function readDualGuestView(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(DUAL_GUEST_VIEW_KEY) === "1";
}
export function AccountSwitcher({
  onPersonaChange,
}: {
  onPersonaChange?: () => void;
}) {
  const { t, configured, refreshSession, pocSwitcher } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!pocSwitcher) return null;

  async function apply(persona: PocPersona) {
    setBusy(true);
    setError("");
    try {
      if (!configured) {
        if (persona === "guest") {
          sessionStorage.removeItem(DEMO_PERSONA_KEY);
          sessionStorage.removeItem(DUAL_GUEST_VIEW_KEY);
        } else {
          sessionStorage.setItem(DEMO_PERSONA_KEY, persona);
          if (persona !== "dual")
            sessionStorage.removeItem(DUAL_GUEST_VIEW_KEY);
        }
        await refreshSession();
        onPersonaChange?.();
        return;
      }
      if (persona === "guest") {
        sessionStorage.removeItem(DUAL_GUEST_VIEW_KEY);
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        });
        await refreshSession();
        onPersonaChange?.();
        return;
      }
      const response = await fetch("/api/poc/switch-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Switch failed");
      sessionStorage.removeItem(DUAL_GUEST_VIEW_KEY);
      if (persona === "dual") {
        sessionStorage.setItem(DUAL_GUEST_VIEW_KEY, "1");
      }
      await refreshSession();
      onPersonaChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch failed");
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<PocPersona, [string, string]> = {
    guest: ["Vizitator", "Guest"],
    owner: ["Proprietar", "Owner"],
    buyer: ["Cumpărător", "Buyer"],
    dual: ["Dual (vizitator + autentificat)", "Dual (guest + signed in)"],
  };
  return (
    <div
      ref={rootRef}
      className="demo-switcher-fab"
      data-testid="poc-account-switcher"
    >
      <button
        type="button"
        className="demo-switcher-fab-trigger button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Users size={14} aria-hidden />
        {t(demoSwitcherChipLabel.ro, demoSwitcherChipLabel.en)}
        <ChevronDown size={14} aria-hidden className={open ? "is-open" : ""} />
      </button>
      {open ? (
        <div id={panelId} className="demo-switcher-fab-panel" role="region">
          <p className="muted small" style={{ margin: "0 0 8px" }}>
            <strong>
              {t(
                "Comutator cont POC (doar staging)",
                "POC account switcher (staging only)",
              )}
            </strong>
          </p>
          <p className="muted small" style={{ margin: "0 0 10px" }}>
            {t(
              "Instrument de demonstrație. Nu este disponibil în producție.",
              "Demo tool. Not available in production.",
            )}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(Object.keys(labels) as PocPersona[]).map((persona) => (
              <button
                key={persona}
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void apply(persona)}
              >
                {t(...labels[persona])}
              </button>
            ))}
          </div>
          {error ? (
            <span className="muted small" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
