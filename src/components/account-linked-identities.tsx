"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Trash2 } from "lucide-react";
import { Feedback, usePlatform } from "@/components/platform";
import type { LinkedIdentity } from "@/lib/auth-oauth";

export function AccountLinkedIdentities() {
  const router = useRouter();
  const { t, viewer } = usePlatform();
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
  const [canUnlink, setCanUnlink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/account/identities", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "load_failed");
      setIdentities(body.data?.identities || []);
      setCanUnlink(Boolean(body.data?.canUnlink));
    } catch {
      setError(
        t(
          "Nu am putut încărca metodele de autentificare.",
          "Could not load sign-in methods.",
        ),
      );
    }
  }, [t]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function unlinkIdentity(identityId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/account/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink", identityId }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "unlink_failed");
      }
      setMessage(
        t(
          "Metoda de autentificare a fost eliminată.",
          "Sign-in method removed.",
        ),
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              "Nu am putut elimina metoda.",
              "Could not remove this sign-in method.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          confirmation: deleteConfirmation,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "delete_failed");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Nu am putut șterge contul.", "Could not delete the account."),
      );
    } finally {
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  }

  const providerLabel = (provider: string) => {
    const map: Record<string, { ro: string; en: string }> = {
      email: { ro: "Email și parolă", en: "Email and password" },
      google: { ro: "Google", en: "Google" },
      apple: { ro: "Apple", en: "Apple" },
      facebook: { ro: "Facebook", en: "Facebook" },
    };
    const labels = map[provider] || { ro: provider, en: provider };
    return t(labels.ro, labels.en);
  };

  return (
    <section className="account-identities" data-testid="account-identities">
      <div className="account-identities-head">
        <Link2 size={18} />
        <h3>{t("Metode de autentificare", "Sign-in methods")}</h3>
      </div>
      <p className="muted small">
        {t(
          "Păstrați cel puțin o metodă de conectare. Autentificarea prin rețele sociale nu acordă acces de echipă (MFA).",
          "Keep at least one sign-in method. Social sign-in does not grant staff access (MFA).",
        )}
      </p>
      <ul className="account-identities-list">
        {identities.map((identity) => (
          <li key={identity.id}>
            <span>{providerLabel(identity.provider)}</span>
            {identity.email ? (
              <span className="muted small">{identity.email}</span>
            ) : null}
            {canUnlink ? (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                data-testid={`unlink-identity-${identity.provider}`}
                onClick={() => void unlinkIdentity(identity.id)}
              >
                {t("Elimină legătura", "Unlink")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <Feedback error={error} message={message} />
      <div className="account-delete-block">
        <Trash2 size={17} />
        <div>
          <strong>{t("Ștergere cont", "Delete account")}</strong>
          <p className="muted small">
            {t(
              "Șterge definitiv contul și datele asociate din workspace (inclusiv conturi create doar cu Google, Apple sau Facebook).",
              "Permanently delete your account and workspace data (including accounts created with Google, Apple, or Facebook only).",
            )}
          </p>
          {!confirmDelete ? (
            <button
              type="button"
              className="text-button danger"
              onClick={() => setConfirmDelete(true)}
            >
              {t("Șterge contul meu", "Delete my account")}
            </button>
          ) : (
            <div className="account-delete-confirm">
              <label className="stack-form">
                <span className="muted small">
                  {t(
                    `Tastează ${viewer?.email || "adresa de email"} sau ȘTERGE pentru a confirma.`,
                    `Type ${viewer?.email || "your email"} or DELETE to confirm.`,
                  )}
                </span>
                <input
                  type="text"
                  name="deleteConfirmation"
                  autoComplete="off"
                  data-testid="delete-confirmation-input"
                  value={deleteConfirmation}
                  onChange={(event) =>
                    setDeleteConfirmation(event.target.value)
                  }
                  disabled={deleteBusy}
                />
              </label>
              <button
                type="button"
                className="button secondary"
                disabled={deleteBusy}
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteConfirmation("");
                }}
              >
                {t("Anulează", "Cancel")}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={deleteBusy || deleteConfirmation.trim().length === 0}
                data-testid="confirm-delete-account"
                onClick={() => void deleteAccount()}
              >
                {deleteBusy
                  ? t("Se șterge…", "Deleting…")
                  : t("Confirmă ștergerea", "Confirm deletion")}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
