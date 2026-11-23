"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe2,
  Menu,
  Moon,
  Sun,
  X,
} from "lucide-react";
import type { MapTileClientConfig } from "@/lib/map-tile-client";
import type { Language, Viewer } from "@/lib/types";
import { localizedMessage, translate } from "@/lib/i18n";
import { PocSiteBanner } from "@/components/disclosures/poc-disclosure";
import {
  CookieConsentBanner,
  CookiePreferencesControl,
} from "@/components/disclosures/cookie-consent-banner";
import { pocFooterLine } from "@/components/disclosures/legal-copy";
import {
  AccountSwitcher,
  readDualGuestView,
} from "@/components/account-switcher";
import { TourHeaderMenu, TourMobileNav } from "@/components/tour/tour-header-menu";
import { TourShell } from "@/components/tour/tour-shell";
type Theme = "system" | "light" | "dark";
type Platform = {
  language: Language;
  t: (ro: string, en: string) => string;
  configured: boolean;
  pocSwitcher: boolean;
  mapTileConfig: MapTileClientConfig;
  viewer: Viewer | null;
  favorites: string[];
  setFavoriteSaved: (id: string, saved: boolean) => void;
  refreshSession: () => Promise<void>;
  catalogueMapPath: string;
  setCatalogueMapPath: (path: string) => void;
};
const Context = createContext<Platform | null>(null);
export function usePlatform() {
  const value = useContext(Context);
  if (!value) throw new Error("Platform provider missing");
  return value;
}

export function PlatformProvider({
  children,
  configured,
  pocSwitcher = false,
  mapTileConfig,
}: {
  children: ReactNode;
  configured: boolean;
  pocSwitcher?: boolean;
  mapTileConfig: MapTileClientConfig;
}) {
  const [language, setLanguage] = useState<Language>("ro");
  const [theme, setTheme] = useState<Theme>("system");
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [menu, setMenu] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [dualGuestView, setDualGuestView] = useState(false);
  const [catalogueMapPath, setCatalogueMapPath] = useState("/map");
  const effectiveViewer = dualGuestView ? null : viewer;
  const setFavoriteSaved = useCallback(
    (id: string, saved: boolean) =>
      setFavorites((previous) =>
        saved
          ? Array.from(new Set([...previous, id]))
          : previous.filter((item) => item !== id),
      ),
    [],
  );
  const t = useCallback(
    (ro: string, en: string) => translate(language, ro, en),
    [language],
  );
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const body = await response.json();
      setViewer(body.data || null);
      if (body.data) {
        const workspace = await fetch("/api/workspace", { cache: "no-store" });
        if (workspace.ok) {
          const result = await workspace.json();
          setFavorites(result.data?.favorites || []);
        }
      } else setFavorites([]);
    } catch {
      setViewer(null);
    }
  }, []);
  const syncDualGuestOverlay = useCallback(() => {
    setDualGuestView(readDualGuestView());
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem("licitatiero-language");
      setLanguage(
        saved === "ro" || saved === "en"
          ? saved
          : navigator.language.toLowerCase().startsWith("en")
            ? "en"
            : "ro",
      );
      const storedTheme = localStorage.getItem("licitatiero-theme");
      if (storedTheme === "light" || storedTheme === "dark")
        setTheme(storedTheme);
      syncDualGuestOverlay();
      void refreshSession();
    });
  }, [refreshSession, syncDualGuestOverlay]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (query.matches ? "dark" : "light") : theme;
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [theme]);
  const toggleLanguage = () => {
    const next = language === "ro" ? "en" : "ro";
    setLanguage(next);
    localStorage.setItem("licitatiero-language", next);
  };
  const cycleTheme = () => {
    const next =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    localStorage.setItem("licitatiero-theme", next);
  };
  return (
    <Context.Provider
      value={{
        language,
        t,
        configured,
        pocSwitcher,
        mapTileConfig,
        viewer: effectiveViewer,
        favorites,
        setFavoriteSaved,
        refreshSession,
        catalogueMapPath,
        setCatalogueMapPath,
      }}
    >
      <TourShell>
      <a className="skip-link" href="#main">
        {t("Sari la conținut", "Skip to content")}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="LicitatieRO">
            <span className="brand-symbol" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              licitație<span className="brand-ro">ro</span>
              <span className="brand-dot">.</span>
            </span>
          </Link>
          <nav
            className="desktop-nav"
            aria-label={t("Navigare principală", "Main navigation")}
          >
            <Link href="/">{t("Descoperă locuințe", "Find a home")}</Link>
            <Link href="/saved-searches">{t("Căutări salvate", "Saved searches")}</Link>
            <Link
              href={catalogueMapPath}
              data-testid="nav-map-link"
              data-tour="nav-map"
            >
              {t("Hartă", "Map")}
            </Link>
            <Link href="/workspace?tab=owner">
              {t("Pentru proprietari", "For owners")}
              <ArrowUpRight size={13} />
            </Link>
          </nav>
          <div className="header-actions">
            <TourHeaderMenu />
            <button
              className="locale-button"
              onClick={toggleLanguage}
              aria-label={t(
                "Schimbă limba în engleză",
                "Switch language to Romanian",
              )}
            >
              <Globe2 size={15} />
              {language.toUpperCase()}
              <ChevronDown size={12} />
            </button>
            <button
              className="icon-button theme-button"
              onClick={cycleTheme}
              aria-label={t(
                `Temă: ${theme}. Schimbă tema`,
                `Theme: ${theme}. Change theme`,
              )}
              title={t(
                "Temă sistem / deschisă / închisă",
                "System / light / dark theme",
              )}
            >
              {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <Link
              className="account-button"
              href={effectiveViewer ? "/workspace" : "/account"}
              data-tour="account-entry"
            >
              {effectiveViewer
                ? t("Spațiul meu", "My workspace")
                : t("Intră în cont", "Sign in")}
              <ArrowUpRight size={15} />
            </Link>
            <button
              className="icon-button mobile-menu"
              aria-expanded={menu}
              aria-label={t("Deschide meniul", "Open menu")}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-navigation">
            <TourMobileNav onNavigate={() => setMenu(false)} />
            <Link href="/" onClick={() => setMenu(false)}>
              {t("Descoperă locuințe", "Find a home")}
            </Link>
            <Link
              href={catalogueMapPath}
              data-testid="nav-map-link-mobile"
              data-tour="nav-map"
              onClick={() => setMenu(false)}
            >
              {t("Hartă", "Map")}
            </Link>
            <Link href="/workspace?tab=owner" onClick={() => setMenu(false)}>
              {t("Pentru proprietari", "For owners")}
            </Link>
            <Link
              href={effectiveViewer ? "/workspace" : "/account"}
              onClick={() => setMenu(false)}
            >
              {effectiveViewer
                ? t("Spațiul meu", "My workspace")
                : t("Intră în cont", "Sign in")}
            </Link>
          </nav>
        )}
      </header>
      <PocSiteBanner />
      {!configured && (
        <div className="demo-banner">
          <span className="status-dot" />
          {t(
            "Catalog demonstrativ — conectează Supabase pentru conturi și salvarea modificărilor.",
            "Demo catalogue — connect Supabase to use accounts and save changes.",
          )}
        </div>
      )}
      <AccountSwitcher onPersonaChange={syncDualGuestOverlay} />
      {children}
      <CookieConsentBanner />
      <footer className="site-footer">
        <div className="footer-top flex-wrap">
          <Link className="brand" href="/">
            licitație<span className="brand-ro">ro</span>
            <span className="brand-dot">.</span>
          </Link>
          <p>
            {t(
              "Un loc al tău. O alegere informată.",
              "A place of your own. A choice you understand.",
            )}
          </p>
          <Link href="/founder">
            {t("Despre proiect", "About the project")}
            <ArrowUpRight size={14} />
          </Link>
          <Link href="/saved-searches">{t("Căutări salvate", "Saved searches")}</Link>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} LicitatieRO ·{" "}
            {t("București, România", "Bucharest, Romania")}
          </span>
          <span>
            <Check size={13} />
            {t(pocFooterLine.ro, pocFooterLine.en)}
          </span>
          <span className="footer-legal-links">
            <Link href="/legal/terms">{t("Termeni (POC)", "Terms (POC)")}</Link>
            {" · "}
            <Link href="/legal/privacy">
              {t("Confidențialitate", "Privacy")}
            </Link>
            {" · "}
            <Link href="/legal/cookies">{t("Cookie-uri", "Cookies")}</Link>
            {" · "}
            <Link href="/legal/data-deletion">
              {t("Ștergere date", "Data deletion")}
            </Link>
            {" · "}
            <CookiePreferencesControl className="footer-link-button" />
          </span>
        </div>
      </footer>
      </TourShell>
    </Context.Provider>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return error ? (
    <div className="feedback error" role="alert">
      {error}
    </div>
  ) : message ? (
    <div className="feedback success" role="status">
      <Check size={16} />
      {message}
    </div>
  ) : null;
}
export function useMutation() {
  const { t, language } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState<{
    signature: string;
    key: string;
  } | null>(null);
  async function mutate(
    action: string,
    payload: Record<string, unknown>,
    success?: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    const signature = JSON.stringify({ action, payload });
    const key =
      attempt?.signature === signature ? attempt.key : crypto.randomUUID();
    setAttempt({ signature, key });
    const needsKey = [
      "place_bid",
      "request_reservation",
      "advance_reservation",
    ].includes(action);
    try {
      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload: {
            ...payload,
            ...(needsKey ? { p_idempotency_key: key } : {}),
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        setAttempt(null);
        throw new Error(
          result.error ||
            t("Acțiunea nu a reușit.", "The action could not be completed."),
        );
      }
      setAttempt(null);
      setMessage(
        success || t("Modificarea a fost salvată.", "Your change was saved."),
      );
      return { data: result.data as unknown };
    } catch (err) {
      setError(
        err instanceof Error
          ? localizedMessage(err.message, language)
          : t(
              "Conexiunea a fost întreruptă. Reîncearcă.",
              "Connection interrupted. Please try again.",
            ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    mutate,
    busy,
    error,
    message,
    clear: () => {
      setError("");
      setMessage("");
    },
  };
}
