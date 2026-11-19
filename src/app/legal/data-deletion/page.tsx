import { LegalDocument } from "@/components/disclosures/legal-document";

export const metadata = { title: "Ștergere date (Meta)" };

const blocks = [
  {
    headingRo: "Cum solicitați ștergerea",
    headingEn: "How to request deletion",
    bodyRo:
      "Puteți șterge contul direct din setările contului (butonul „Șterge contul meu”) sau ne puteți scrie la adresa de contact pentru solicitări GDPR publicată în politica de confidențialitate (textul final al adresei este în curs de validare juridică). Pentru conturile create prin Facebook Login, această pagină descrie ce date ștergem atunci când primim o solicitare validă sau când folosiți ștergerea din cont.",
    bodyEn:
      "You can delete your account from account settings (the “Delete my account” button) or email us at the GDPR contact address published in the privacy notice (the final address is pending legal sign-off). For accounts created via Facebook Login, this page describes what we delete when we receive a valid request or when you use in-app account deletion.",
  },
  {
    headingRo: "Ce date sunt șterse",
    headingEn: "What is deleted",
    bodyRo:
      "La ștergere eliminăm contul de autentificare Supabase (inclusiv identitățile Google, Apple, Facebook sau email), profilul din workspace, căutările salvate, favoritele, mesajele și celelalte înregistrări legate de cont conform politicilor de reținere. Nu păstrăm token-urile OAuth ale furnizorilor în afara sesiunii gestionate de Supabase Auth.",
    bodyEn:
      "On deletion we remove the Supabase authentication account (including Google, Apple, Facebook, or email identities), your workspace profile, saved searches, favourites, messages, and other records tied to the account under our retention rules. We do not keep provider OAuth tokens outside the session managed by Supabase Auth.",
  },
  {
    headingRo: "Termene",
    headingEn: "Timelines",
    bodyRo:
      "Ștergerea inițiată din cont este procesată imediat, în limita disponibilității serviciului. Solicitările trimise prin email sunt confirmate în termen de 30 de zile calendaristice, cu posibilitatea de prelungire justificată conform GDPR. Copiile din jurnale tehnice sau arhive de siguranță sunt pseudonimizate sau eliminate conform politicii de reținere (detaliile finale urmează validării juridice).",
    bodyEn:
      "Deletion started in-app is processed immediately when the service is available. Email requests are acknowledged within 30 calendar days, with justified extension where GDPR allows. Copies in technical logs or backup archives are pseudonymised or removed under the retention policy (final detail pending legal review).",
  },
];

export default function DataDeletionPage() {
  return (
    <LegalDocument
      titleRo="Instrucțiuni de ștergere a datelor (cerință Meta)"
      titleEn="Data deletion instructions (Meta requirement)"
      blocks={blocks}
    />
  );
}
