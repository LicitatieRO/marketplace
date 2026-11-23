export const DATA_PROTECTION_CONTACT_FALLBACK_RO =
  "Datele de contact pentru protecția datelor vor fi publicate în politica de confidențialitate înainte de deschiderea platformei către utilizatori reali (versiune POC).";

export const DATA_PROTECTION_CONTACT_FALLBACK_EN =
  "The data-protection contact details will be published in the privacy notice before the platform opens to real users (POC version).";

export function isDataProtectionContactConfigured(): boolean {
  return Boolean(
    process.env.DATA_PROTECTION_CONTACT?.trim() ||
      process.env.NEXT_PUBLIC_DATA_PROTECTION_CONTACT?.trim(),
  );
}

/** Data-protection contact for legal copy; unset until the privacy notice publishes it (#73). */
export function dataProtectionContactText(locale: "ro" | "en"): string {
  const configured =
    process.env.DATA_PROTECTION_CONTACT?.trim() ||
    process.env.NEXT_PUBLIC_DATA_PROTECTION_CONTACT?.trim();
  if (configured) return configured;
  return locale === "ro"
    ? DATA_PROTECTION_CONTACT_FALLBACK_RO
    : DATA_PROTECTION_CONTACT_FALLBACK_EN;
}
