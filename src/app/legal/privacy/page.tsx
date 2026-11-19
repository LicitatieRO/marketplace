import { LegalDocument } from "@/components/disclosures/legal-document";
export const metadata = { title: "Confidențialitate POC" };
const blocks = [
  {
    headingRo: "Rolul POC",
    headingEn: "POC role",
    bodyRo:
      "Prelucrăm datele necesare demonstrației: cont, preferințe de limbă/temă (stocare locală strict necesară), conținut generat în workspace și jurnale tehnice. Nu colectăm date de card în această versiune POC.",
    bodyEn:
      "We process data needed for the demonstration: account, language/theme preferences (strictly necessary local storage), workspace content and technical logs. We do not collect card data in this POC version.",
  },
  {
    headingRo: "Conținut opțional de la terți",
    headingEn: "Optional third-party content",
    bodyRo:
      "Tururi (Kuula/Matterport) și hărți interactive, dacă sunt activate, se încarcă numai după consimțământul dvs. explicit sau alegerea „Accept conținutul opțional”. Furnizorii pot primi adresa IP și identificatori tehnici.",
    bodyEn:
      "Tours (Kuula/Matterport) and interactive maps, if enabled, load only after your explicit consent or the “Accept optional content” choice. Providers may receive your IP address and technical identifiers.",
  },
  {
    headingRo: "Previzualizarea e-mailurilor tranzacționale (mediu de test / POC)",
    headingEn: "Transactional email previews (test environment / POC)",
    bodyRo:
      "Când platforma rulează în mod de test, e-mailurile tranzacționale (de ex. confirmarea contului, notificări despre licitații) nu sunt trimise efectiv, ci salvate ca previzualizări interne. Acest mod nu este folosit în funcționarea normală a platformei în producție. Pentru fiecare previzualizare stocăm subiectul, conținutul mesajului și data generării, legate de notificarea respectivă. Conținutul poate include un link personal de confirmare a contului sau de autentificare. Adresa de e-mail a destinatarului nu este copiată în previzualizare; ea este preluată din contul dumneavoastră și afișată mascat. Previzualizările pot fi consultate doar de personalul autorizat al platformei, autentificat cu verificare în doi pași. Linkurile de confirmare sunt ascunse implicit; în mediul de test, personalul autorizat le poate afișa individual pentru testare, iar fiecare afișare este înregistrată. Scop: verificarea conținutului și a fluxului e-mailurilor tranzacționale înainte de lansare, fără a trimite mesaje reale. Temei juridic: interesul nostru legitim de a testa și securiza serviciul (art. 6 alin. (1) lit. f) GDPR). Durată de stocare: previzualizările sunt păstrate până când sunt șterse de personalul autorizat sau la cererea dvs. (vezi „Drepturile dvs.”). Previzualizările nu sunt transmise unui furnizor de e-mail. Puteți cere acces la ele sau ștergerea lor, conform secțiunii „Drepturile dvs.”.",
    bodyEn:
      'When the platform runs in test mode, transactional emails (e.g. account confirmation, auction notifications) are not actually sent; they are saved as internal previews instead. This mode is not used in normal production operation. For each preview we store the subject, the message body and the time it was generated, linked to the related notification. The body may include a personal account-confirmation or sign-in link. The recipient\'s email address is not copied into the preview; it is taken from your account and shown masked. Previews can be viewed only by authorised platform staff signed in with two-step verification. Confirmation links are hidden by default; in the test environment, authorised staff can reveal them one at a time for testing, and each reveal is logged. Purpose: checking the content and flow of transactional emails before launch, without sending real messages. Legal basis: our legitimate interest in testing and securing the service (Art. 6(1)(f) GDPR). Retention: previews are kept until they are deleted by authorised staff or at your request (see "Your rights"). Previews are not passed to any email provider. You can ask for access to them or their deletion, as described under "Your rights".',
  },
  {
    headingRo: "Autentificare prin furnizori de identitate",
    headingEn: "Sign-in with identity providers",
    bodyRo:
      "Dacă alegeți Google, Apple sau Meta (Facebook), acești furnizori ne transmit datele minime necesare creării sau autentificării contului (de obicei nume, adresă de email și identificator tehnic). Scop: executarea relației contractuale de cont și autentificare (art. 6 alin. (1) lit. b) GDPR). Emailurile Apple Private Relay sunt tratate ca orice altă adresă de contact. Nu folosim aceste date pentru publicitate sau profilare și nu stocăm token-urile furnizorilor în afara mecanismului Supabase Auth.",
    bodyEn:
      "If you choose Google, Apple, or Meta (Facebook), those providers send us the minimum data needed to create or sign in to your account (typically name, email address, and a technical identifier). Purpose: performance of the account contract and authentication (Art. 6(1)(b) GDPR). Apple Private Relay emails are handled like any other contact address. We do not use this data for advertising or profiling and we do not store provider tokens outside Supabase Auth.",
  },
  {
    headingRo: "Drepturile dvs.",
    headingEn: "Your rights",
    bodyRo:
      "În sesiunea autentificată puteți solicita exportul datelor proprii și ștergerea/anonimizarea conform funcțiilor din cont, fără acces la datele altor utilizatori.",
    bodyEn:
      "When signed in you may request export of your own data and deletion/anonymization via account features, without access to other users’ data.",
  },
];
export default function LegalPrivacyPage() {
  return (
    <LegalDocument
      titleRo="Politica de confidențialitate (POC)"
      titleEn="Privacy policy (POC)"
      blocks={blocks}
    />
  );
}