"use client";

import {
  mfaFactorDisplayLabel,
  type MfaTotpFactorRow,
} from "@/lib/mfa-factor-display";
import { usePlatform } from "./platform";

export function MfaUnenrollPicker({
  factors,
  selectedId,
  onSelect,
  disabled,
}: {
  factors: MfaTotpFactorRow[];
  selectedId: string;
  onSelect: (factorId: string) => void;
  disabled?: boolean;
}) {
  const { t, language } = usePlatform();
  const locale = language === "ro" ? "ro-RO" : "en-GB";
  return (
    <fieldset className="mfa-factor-picker">
      <legend>
        {t(
          "Alege autentificatorul de eliminat",
          "Choose which authenticator to remove",
        )}
      </legend>
      <ul className="mfa-factor-list">
        {factors.map((factor) => {
          const created =
            factor.created_at || factor.createdAt
              ? new Date(
                  String(factor.created_at || factor.createdAt),
                ).toLocaleString(locale)
              : t("Dată necunoscută", "Unknown date");
          return (
            <li key={factor.id}>
              <label className="mfa-factor-option">
                <input
                  type="radio"
                  name="mfa-unenroll-factor"
                  value={factor.id}
                  checked={selectedId === factor.id}
                  disabled={disabled}
                  onChange={() => onSelect(factor.id)}
                />
                <span className="mfa-factor-label">
                  {mfaFactorDisplayLabel(factor)}
                </span>
                <span className="mfa-factor-meta">{created}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
