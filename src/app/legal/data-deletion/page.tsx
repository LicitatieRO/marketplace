import { LegalDocument } from "@/components/disclosures/legal-document";

export const metadata = { title: "Ștergere date (Meta)" };

const blocks = [
  {
    headingRo: "Cum solicitați ștergerea",
    headingEn: "How to request deletion",
    bodyRo:
      "Puteți șterge contul direct din setările contului (butonul „Șterge contul meu”) sau ne puteți scrie la adresa de contact pentru solicitări GDPR publicată în politica de confidențialitate. Pentru conturile create prin Facebook Login, această pagină descrie ce se întâmplă când trimiteți o solicitare validă sau folosiți ștergerea din cont.",
    bodyEn:
      "You can delete your account from account settings (the “Delete my account” button) or email us at the GDPR contact address published in the privacy notice. For accounts created via Facebook Login, this page describes what happens when you submit a valid request or use in-app account deletion.",
  },
  {
    headingRo: "Ce se șterge automat din cont",
    headingEn: "What in-app deletion removes",
    bodyRo:
      "Dacă nu aveți istoric în marketplace (fără anunțuri, licitații, oferte, rezervări, mesaje, favorite, promovări plătite sau sesizări legate de activitatea contului), ștergerea din cont elimină imediat contul de autentificare Supabase (inclusiv identitățile Google, Apple, Facebook sau email), profilul din workspace și căutările salvate. Nu păstrăm token-uri OAuth ale furnizorilor în afara sesiunii gestionate de Supabase Auth.",
    bodyEn:
      "If you have no marketplace history (no listings, auctions, bids, reservations, messages, favourites, paid promotions, or reports tied to account activity), in-app deletion immediately removes your Supabase authentication account (including Google, Apple, Facebook, or email identities), your workspace profile, and saved searches. We do not keep provider OAuth tokens outside the session managed by Supabase Auth.",
  },
  {
    headingRo: "Conturi cu istoric în marketplace",
    headingEn: "Accounts with marketplace history",
    bodyRo:
      "Dacă aveți istoric (de exemplu anunțuri închise, oferte, mesaje, favorite, promovări sau sesizări), ștergerea automată nu este disponibilă din cauza obligațiilor legale și a integrității tranzacțiilor. Trimiteți o solicitare de ștergere la adresa GDPR din politica de confidențialitate; răspundem în cel mult 30 de zile calendaristice. Păstrăm sau anonimizăm datele pe care legea ne cere să le reținem; restul este șters sau pseudonimizat conform politicii de confidențialitate.",
    bodyEn:
      "If you have marketplace history (for example closed listings, bids, messages, favourites, promotions, or reports), automatic in-app deletion is not available because of legal obligations and transaction integrity. Send a deletion request to the GDPR contact address in the privacy notice; we respond within 30 calendar days. We retain or anonymise data we must keep by law; other data is erased or pseudonymised under our privacy notice.",
  },
  {
    headingRo: "Termene",
    headingEn: "Timelines",
    bodyRo:
      "Ștergerea automată fără istoric este procesată imediat, în limita disponibilității serviciului. Solicitările trimise la adresa GDPR din politica de confidențialitate sunt confirmate în termen de 30 de zile calendaristice, cu prelungire justificată acolo unde GDPR o permite. Copiile din jurnale tehnice sau arhive de siguranță sunt pseudonimizate sau eliminate conform politicii de reținere.",
    bodyEn:
      "Automatic deletion without marketplace history is processed immediately when the service is available. Requests sent to the GDPR contact address in the privacy notice are acknowledged within 30 calendar days, with justified extension where GDPR allows. Copies in technical logs or backup archives are pseudonymised or removed under the retention policy.",
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
