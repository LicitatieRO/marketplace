"use client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  authBidIntentNotice,
  classifyPostAuthDestination,
  postAuthCtaLabel,
  resolveAuthIntent,
  shouldRedirectAfterAuth,
} from "@/lib/auth-return";
import { safeReturnPath } from "@/lib/security";
import { localizedMessage } from "@/lib/i18n";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Feedback, usePlatform } from "./platform";
import { AccountSecurity } from "./account-security";
import { AccountLinkedIdentities } from "./account-linked-identities";
import { SocialLoginButtons } from "./social-login-buttons";
import { signupPocCheckbox, accountVerificationPoc } from "./disclosures/legal-copy";
type Mode = "login" | "signup" | "recover" | "reset";
export function Account({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language, configured, viewer, refreshSession } = usePlatform();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pocAccepted, setPocAccepted] = useState(false);
  const returnTo = safeReturnPath(
    searchParams.get("next"),
    searchParams.get("redirectTo"),
  );
  const authIntent = resolveAuthIntent(returnTo, searchParams.get("intent"));
  const bidIntent = authIntent === "bid";
  const postAuthDestination = classifyPostAuthDestination(returnTo);
  const postAuthCta = postAuthCtaLabel[postAuthDestination];
  const changeMode = (next: Mode) => {
    setMode(next);
    setError("");
    setMessage("");
    const qs = new URLSearchParams({ mode: next, next: returnTo });
    const intent = searchParams.get("intent");
    if (intent) qs.set("intent", intent);
    router.replace(`/account?${qs.toString()}`);
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    if (mode === "signup" && !pocAccepted) {
      setError(
        t(
          "Pentru a crea un cont, acceptați termenii POC.",
          "To create an account, accept the POC terms.",
        ),
      );
      setBusy(false);
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email: form.get("email") || undefined,
          password: form.get("password") || undefined,
          displayName: form.get("displayName") || undefined,
          next: returnTo,
        }),
      });
      const body = await response.json();
      if (!response.ok || body.error)
        throw new Error(
          body.error ||
            t(
              "Nu am putut finaliza cererea.",
              "We could not complete your request.",
            ),
        );
      setMessage(
        localizedMessage(
          body.data?.message ||
            t("Cererea a fost procesată.", "Your request was processed."),
          language,
        ),
      );
      await refreshSession();
      let hasSession = false;
      if (mode === "login" || mode === "signup") {
        try {
          const sessionResponse = await fetch("/api/session", {
            cache: "no-store",
          });
          const sessionBody = await sessionResponse.json();
          hasSession = Boolean(sessionBody.data);
        } catch {
          hasSession = false;
        }
      }
      if (shouldRedirectAfterAuth(mode, hasSession)) router.push(returnTo);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizedMessage(err.message, language)
          : t(
              "Conexiune indisponibilă. Reîncearcă.",
              "Connection unavailable. Please try again.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await refreshSession();
      setMessage(t("Ai ieșit din cont.", "You are signed out."));
    } catch (err) {
      setError(
        err instanceof Error
          ? localizedMessage(err.message, language)
          : t("Nu am putut închide sesiunea.", "Could not sign out."),
      );
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "signup"
      ? t("Povestea ta", "Your story")
      : mode === "recover"
        ? t("Se mai întâmplă.", "It happens.")
        : mode === "reset"
          ? t("Un nou început.", "A fresh start.")
          : t("Bine ai", "Welcome");
  const emphasis =
    mode === "signup"
      ? t("începe aici.", "starts here.")
      : mode === "recover"
        ? t("O rezolvăm.", "Let’s fix it.")
        : mode === "reset"
          ? t("O parolă nouă.", "A new password.")
          : t("revenit.", "back.");
  return (
    <main id="main" className="account-page page-width">
      <div className="account-story">
        <div className="eyebrow">
          {t("UN CONT. NOI POSIBILITĂȚI.", "ONE ACCOUNT. NEW POSSIBILITIES.")}
        </div>
        <h1>
          {title}
          <br />
          <em>{emphasis}</em>
        </h1>
        <p>
          {t(
            "Salvează locurile care îți plac. Vorbește cu proprietarii. Fă următorul pas în ritmul tău.",
            "Save the places you love. Talk to their owners. Take the next step at your own pace.",
          )}
        </p>
        <div className="account-illustration">
          <div className="illustration-window">
            <span />
            <span />
            <span />
            <span />
          </div>
          <span className="illustration-sun" />
          <span className="illustration-plant" />
          <div className="illustration-caption">
            {t("FIECARE UȘĂ DESCHIDE O POVESTE.", "EVERY DOOR OPENS A STORY.")}
          </div>
        </div>
        <div className="account-promise">
          <ShieldCheck size={19} />
          <span>
            {t(
              "POC / Simulare — fără bani reali, fără escrow, fără transfer de proprietate.",
              "POC / Simulation — no real money, no escrow, no transfer of title.",
            )}
          </span>
        </div>
      </div>
      <div className="account-form-wrap">
        {viewer && mode !== "reset" ? (
          <div className="account-signed-in">
            <span className="round-icon">
              <Check />
            </span>
            <div className="eyebrow">{t("EȘTI ACASĂ", "YOU’RE HOME")}</div>
            <h2>
              {t("Salut,", "Hello,")}{" "}
              {viewer.display_name || viewer.email.split("@")[0]}.
            </h2>
            <p>{viewer.email}</p>
            <p className="muted small">
              {t(accountVerificationPoc.ro, accountVerificationPoc.en)}
            </p>
            {bidIntent ? (
              <p
                className="muted small"
                data-testid="auth-bid-intent-notice"
              >
                {t(authBidIntentNotice.ro, authBidIntentNotice.en)}
              </p>
            ) : null}
            <Link
              className="button primary"
              href={returnTo}
              data-testid="auth-post-sign-in-cta"
            >
              {t(postAuthCta.ro, postAuthCta.en)}
              <ArrowRight size={16} />
            </Link>
            <button className="text-button" onClick={logout} disabled={busy}>
              {t("Ieși din cont", "Sign out")}
            </button>
            <Feedback error={error} message={message} />
            {viewer.is_staff && (
              <div className="staff-security">
                <LockKeyhole size={20} />
                <div>
                  <strong>
                    {t(
                      "Securitatea contului de echipă",
                      "Staff account security",
                    )}
                  </strong>
                  <p>
                    {viewer.aal === "aal2"
                      ? t(
                          "Sesiune verificată prin autentificare multifactor.",
                          "This session is verified with multifactor authentication.",
                        )
                      : t(
                          "Operațiunile de echipă necesită o sesiune MFA (aal2). Verifică un autentificator folosind secțiunea de mai jos.",
                          "Staff operations require an MFA session (aal2). Verify your authenticator using the section below.",
                        )}
                  </p>
                </div>
              </div>
            )}
            <AccountLinkedIdentities />
            <AccountSecurity />
          </div>
        ) : (
          <>
            <div className="form-topline">
              <span>
                {mode === "signup"
                  ? t("CREEAZĂ UN CONT", "CREATE AN ACCOUNT")
                  : mode === "recover" || mode === "reset"
                    ? t("SIGURANȚA CONTULUI", "ACCOUNT SECURITY")
                    : t("CONTUL TĂU", "YOUR ACCOUNT")}
              </span>
              <KeyRound size={21} />
            </div>
            <h2>
              {mode === "signup"
                ? t("Facem cunoștință?", "Shall we get acquainted?")
                : mode === "recover"
                  ? t("Recuperează accesul", "Recover your access")
                  : mode === "reset"
                    ? t("Alege o parolă nouă", "Choose a new password")
                    : t("Intră în cont", "Sign in")}
            </h2>
            <p className="muted">
              {mode === "signup"
                ? t(
                    "Un singur cont pentru cumpărare, închiriere și propriile anunțuri.",
                    "One account to buy, rent, and list your own properties.",
                  )
                : mode === "recover"
                  ? t(
                      "Îți trimitem pe email un link pentru resetarea parolei.",
                      "We’ll email you a link to reset your password.",
                    )
                  : mode === "reset"
                    ? t(
                        "Linkul de recuperare trebuie deschis înainte de acest pas.",
                        "Open your recovery link before completing this step.",
                      )
                    : t(
                        "Locuințele și conversațiile tale te așteaptă.",
                        "Your saved homes and conversations are waiting.",
                      )}
            </p>
            {bidIntent && (mode === "login" || mode === "signup") ? (
              <p
                className="muted small"
                data-testid="auth-bid-intent-notice"
              >
                {t(authBidIntentNotice.ro, authBidIntentNotice.en)}
              </p>
            ) : null}
            {mode === "reset" && viewer?.email ? (
              <p
                className="muted small"
                data-testid="reset-session-email"
              >
                {t(
                  `Resetezi parola pentru ${viewer.email}. Dacă nu ai deschis un link de recuperare, ieși din cont.`,
                  `Resetting the password for ${viewer.email}. If you did not open a recovery link, sign out.`,
                )}
              </p>
            ) : null}
            {!configured && (
              <div className="feedback notice">
                <LockKeyhole size={19} />
                <span>
                  {t(
                    "Acesta este un catalog demonstrativ. Conturile sunt disponibile după conectarea Supabase; nu creăm sesiuni fictive.",
                    "This is a demo catalogue. Accounts become available after connecting Supabase; demo sign-ins are not created.",
                  )}
                </span>
              </div>
            )}
            <form onSubmit={submit} className="stack-form">
              {mode === "signup" && (
                <label>
                  {t("Numele tău", "Your name")}
                  <input
                    name="displayName"
                    autoComplete="name"
                    maxLength={100}
                    required
                    placeholder={t("Cum te numești?", "What’s your name?")}
                    disabled={!configured}
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label>
                  {t("Adresa de email", "Email address")}
                  <div className="input-with-icon">
                    <Mail size={17} />
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="tu@exemplu.ro"
                      disabled={!configured}
                    />
                  </div>
                </label>
              )}
              {mode !== "recover" && (
                <label>
                  {t("Parola", "Password")}
                  <div className="input-with-icon">
                    <LockKeyhole size={17} />
                    <input
                      name="password"
                      type="password"
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      minLength={12}
                      maxLength={128}
                      required
                      placeholder={t(
                        "Minimum 12 caractere",
                        "At least 12 characters",
                      )}
                      disabled={!configured}
                    />
                  </div>
                </label>
              )}
              {mode === "login" && (
                <button
                  className="text-button forgot-password"
                  type="button"
                  onClick={() => changeMode("recover")}
                >
                  {t("Ai uitat parola?", "Forgot your password?")}
                </button>
              )}
              {mode === "signup" && (
                <>
                  <p className="muted small">
                    {t(
                      "Vei primi un email de confirmare. Confirmă adresa înainte de a publica sau de a trimite oferte.",
                      "You’ll receive a verification email. Verify your address before publishing or making offers.",
                    )}
                  </p>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={pocAccepted}
                      onChange={(event) =>
                        setPocAccepted(event.target.checked)
                      }
                      disabled={!configured}
                    />
                    <span>
                      {t(signupPocCheckbox.ro, signupPocCheckbox.en)}{" "}
                      <Link href="/legal/terms">
                        {t("Termenii POC", "POC Terms")}
                      </Link>
                      {" · "}
                      <Link href="/legal/privacy">
                        {t("Confidențialitate", "Privacy")}
                      </Link>
                    </span>
                  </label>
                </>
              )}
              <Feedback error={error} message={message} />
              <button className="button primary" disabled={busy || !configured}>
                {busy
                  ? t("Un moment…", "One moment…")
                  : mode === "signup"
                    ? t("Creează contul", "Create account")
                    : mode === "recover"
                      ? t("Trimite linkul de recuperare", "Send recovery link")
                      : mode === "reset"
                        ? t("Salvează parola nouă", "Save new password")
                        : t("Intră în cont", "Sign in")}
                <ArrowUpRight size={17} />
              </button>
            </form>
            {(mode === "login" || mode === "signup") && (
              <SocialLoginButtons nextPath={returnTo} />
            )}
            <div className="account-switch">
              {mode === "login" ? (
                <>
                  {t("Ești nou pe aici?", "New around here?")}{" "}
                  <button onClick={() => changeMode("signup")}>
                    {t("Creează un cont", "Create an account")}
                  </button>
                </>
              ) : (
                <button onClick={() => changeMode("login")}>
                  {t("Înapoi la autentificare", "Back to sign in")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
