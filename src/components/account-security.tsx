"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, type FormEvent } from "react";
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  mfaFactorDisplayLabel,
  verifiedTotpFactors,
  type MfaTotpFactorRow,
} from "@/lib/mfa-factor-display";
import { MfaUnenrollPicker } from "@/components/mfa-unenroll-picker";
import { Feedback, usePlatform } from "./platform";

type UnenrollStep = "idle" | "pick" | "confirm";

export function AccountSecurity() {
  const { t, viewer, refreshSession } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [unenrollStep, setUnenrollStep] = useState<UnenrollStep>("idle");
  const [unenrollFactors, setUnenrollFactors] = useState<MfaTotpFactorRow[]>(
    [],
  );
  const [unenrollFactor, setUnenrollFactor] = useState("");

  function resetUnenrollFlow() {
    setUnenrollStep("idle");
    setUnenrollFactors([]);
    setUnenrollFactor("");
  }

  async function request(
    action: "enroll" | "list" | "verify" | "unenroll",
    code?: string,
    factorId?: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "verify" ? { factorId: factor, code } : {}),
          ...(action === "unenroll" && factorId ? { factorId } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok || body.error)
        throw new Error(
          body.error ||
            t(
              "Nu am putut actualiza autentificatorul.",
              "Could not update the authenticator.",
            ),
        );
      if (action === "enroll") {
        setFactor(body.data.id);
        const source = String(body.data.totp.qr_code);
        setQr(
          source.startsWith("<")
            ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
            : source,
        );
      } else if (action === "list") {
        const existing = body.data.totp?.find(
          (item: { id: string; status: string }) => item.status === "verified",
        );
        if (!existing)
          throw new Error(
            t(
              "Nu există un autentificator verificat. Adaugă unul nou.",
              "No verified authenticator found. Add a new one.",
            ),
          );
        setFactor(existing.id);
        setQr("");
      } else if (action === "unenroll") {
        resetUnenrollFlow();
        setMessage(
          body.data?.message ||
            t(
              "Autentificatorul a fost eliminat.",
              "Authenticator removed.",
            ),
        );
        await refreshSession();
      } else {
        setFactor("");
        setQr("");
        setMessage(
          t(
            "Autentificare multifactor verificată pentru această sesiune.",
            "Multifactor authentication verified for this session.",
          ),
        );
        await refreshSession();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("Cererea nu a reușit.", "The request failed."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function beginUnenrollPicker() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const body = await response.json();
      if (!response.ok || body.error) {
        throw new Error(
          body.error ||
            t(
              "Nu am putut citi autentificatorii.",
              "Could not read authenticators.",
            ),
        );
      }
      const verified = verifiedTotpFactors(body.data.totp as MfaTotpFactorRow[]);
      if (verified.length === 0) {
        throw new Error(
          t(
            "Nu există un autentificator verificat.",
            "No verified authenticator found.",
          ),
        );
      }
      setUnenrollFactors(verified);
      setUnenrollFactor("");
      setUnenrollStep("pick");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("Cererea nu a reușit.", "The request failed."),
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedUnenroll =
    unenrollFactors.find((item) => item.id === unenrollFactor) ?? null;

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void request("verify", String(form.get("code")));
  }

  return (
    <section className="account-security">
      <div className="security-heading">
        <ShieldCheck size={20} />
        <h3>{t("Un plus de siguranță", "A little extra security")}</h3>
      </div>
      <p>
        {t(
          "Protejează-ți contul cu o aplicație de autentificare. Conturile de echipă necesită MFA pentru operațiuni privilegiate.",
          "Protect your account with an authenticator app. Staff accounts require MFA for privileged operations.",
        )}
      </p>
      {viewer?.aal === "aal2" ? (
        <div className="stack-form">
          <div className="security-verified">
            <Check size={15} />
            {t("Sesiune MFA verificată", "MFA session verified")}
          </div>
          {unenrollStep === "pick" ? (
            <>
              <MfaUnenrollPicker
                factors={unenrollFactors}
                selectedId={unenrollFactor}
                onSelect={setUnenrollFactor}
                disabled={busy}
              />
              <div className="security-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || !unenrollFactor}
                  onClick={() => setUnenrollStep("confirm")}
                >
                  {t("Continuă", "Continue")}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={resetUnenrollFlow}
                >
                  {t("Anulează", "Cancel")}
                </button>
              </div>
            </>
          ) : unenrollStep === "confirm" && selectedUnenroll ? (
            <>
              <p>
                {t(
                  "Vei elimina:",
                  "You are about to remove:",
                )}{" "}
                <strong>{mfaFactorDisplayLabel(selectedUnenroll)}</strong>
              </p>
              <p>
                {viewer.is_staff
                  ? t(
                      "Conturile de echipă trebuie să păstreze cel puțin un autentificator verificat. Dacă ai mai mulți, poți elimina unul secundar.",
                      "Staff accounts must keep at least one verified authenticator. If you have more than one, you may remove a secondary factor.",
                    )
                  : t(
                      "Eliminarea autentificatorului reduce protecția contului. Continui?",
                      "Removing your authenticator reduces account protection. Continue?",
                    )}
              </p>
              <div className="security-actions">
                <button
                  type="button"
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void request("unenroll", undefined, unenrollFactor)
                  }
                >
                  {t("Confirmă eliminarea", "Confirm removal")}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => setUnenrollStep("pick")}
                >
                  {t("Înapoi", "Back")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                {t(
                  "Poți elimina un autentificator pierdut sau înlocuit.",
                  "You can remove a lost or replaced authenticator.",
                )}
              </p>
              <div className="security-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void beginUnenrollPicker()}
                >
                  {t("Elimină autentificatorul", "Remove authenticator")}
                </button>
              </div>
            </>
          )}
        </div>
      ) : factor ? (
        <form onSubmit={verify} className="stack-form">
          {qr && (
            <>
              <p>
                {t(
                  "Scanează codul cu aplicația de autentificare, apoi introdu codul de șase cifre.",
                  "Scan this code with your authenticator app, then enter its six-digit code.",
                )}
              </p>
              <img
                className="mfa-qr"
                src={qr}
                alt={t(
                  "Cod QR pentru configurarea autentificatorului",
                  "Authenticator setup QR code",
                )}
              />
            </>
          )}
          <label>
            {t("Cod de șase cifre", "Six-digit code")}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              required
              placeholder="000000"
            />
          </label>
          <button className="button primary" disabled={busy}>
            <LockKeyhole size={15} />
            {t("Verifică sesiunea", "Verify session")}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setFactor("");
              setQr("");
            }}
          >
            {t("Înapoi", "Back")}
          </button>
        </form>
      ) : (
        <div className="security-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void request("list")}
          >
            {t("Am un autentificator", "Use my authenticator")}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void request("enroll")}
          >
            {t("Adaugă un autentificator", "Add an authenticator")}
          </button>
        </div>
      )}
      <Feedback error={error} message={message} />
    </section>
  );
}
