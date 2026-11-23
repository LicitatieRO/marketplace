import { LegalDocument } from "@/components/disclosures/legal-document";
import { dataProtectionContactText } from "@/lib/data-protection-contact";

export const metadata = { title: "Ștergere date (Meta)" };

function dataDeletionBlocks() {
  const privacyContactRo = dataProtectionContactText("ro");
  const privacyContactEn = dataProtectionContactText("en");

  return [
    {
      headingRo: "Cum solicitați ștergerea",
      headingEn: "How to request deletion",
      bodyRo: `Aveți dreptul să cereți ștergerea datelor dvs. personale (art. 17 GDPR). Puteți face acest lucru (1) din setările contului, cu butonul „Șterge contul meu”, sau (2) printr-o solicitare trimisă la ${privacyContactRo}, de preferat de pe adresa de email a contului. Aceleași reguli se aplică și conturilor create prin Google, Apple sau Facebook Login. Ștergerea contului LicitatieRO nu șterge contul dvs. la acești furnizori; puteți elimina separat accesul aplicației din setările contului Google, Apple sau Facebook.`,
      bodyEn: `You have the right to ask us to erase your personal data (GDPR Art. 17). You can do this (1) from account settings, using the "Delete my account" button, or (2) by sending a request to ${privacyContactEn}, preferably from your account's email address. The same rules apply to accounts created with Google, Apple or Facebook Login. Deleting your LicitatieRO account does not delete your account with those providers; you can separately remove the app's access in your Google, Apple or Facebook account settings.`,
    },
    {
      headingRo: "Ștergerea automată din cont",
      headingEn: "In-app deletion",
      bodyRo:
        "Ștergerea din cont este disponibilă dacă pe cont nu există activitate înregistrată (de exemplu anunțuri, licitații, oferte, rezervări, mesaje, cereri de vizionare, favorite, notificări, promovări sau sesizări). În acest caz, după confirmare, ștergem contul de autentificare (inclusiv metodele de conectare Google, Apple, Facebook, email sau passkey), profilul și căutările salvate, iar sesiunile active sunt închise. Nu păstrăm token-uri OAuth ale furnizorilor în afara sesiunii gestionate de serviciul de autentificare (Supabase Auth). Jurnalele de securitate pot păstra un identificator tehnic pseudonimizat al acțiunilor efectuate, care nu mai este asociat cu un cont existent.",
      bodyEn:
        "In-app deletion is available if your account has no recorded activity (for example listings, auctions, bids, reservations, messages, viewing requests, favourites, notifications, promotions or reports). In that case, after you confirm, we delete your sign-in account (including Google, Apple, Facebook, email or passkey sign-in methods), your profile and your saved searches, and your active sessions are ended. We do not keep provider OAuth tokens outside the session managed by our authentication service (Supabase Auth). Security logs may keep a pseudonymised technical identifier for actions taken, which is no longer associated with an existing account.",
    },
    {
      headingRo: "Când ștergerea din cont este blocată temporar",
      headingEn: "When in-app deletion is temporarily blocked",
      bodyRo:
        "Ștergerea din cont nu este disponibilă cât timp aveți un anunț publicat, o licitație programată sau activă, o ofertă într-o licitație în desfășurare, o rezervare în curs sau o promovare în așteptare ori activă. Închideți sau finalizați aceste elemente și încercați din nou, sau trimiteți o solicitare de ștergere (vezi mai jos). Dacă ați trimis o sesizare privind conținut ilegal folosind adresa de email a contului, ștergerea se face prin solicitare, deoarece sesizarea și decizia luată trebuie păstrate cât timp pot fi contestate. Conturile echipei platformei nu pot fi șterse din această interfață.",
      bodyEn:
        "In-app deletion is unavailable while you have a published listing, a scheduled or active auction, a bid in an ongoing auction, an open reservation, or a pending or active promotion. Close or complete these and try again, or send a deletion request (see below). If you submitted an illegal-content report using your account's email address, deletion is handled by request, because the report and the decision taken on it must be kept while they can still be contested. Platform staff accounts cannot be deleted here.",
    },
    {
      headingRo: "Conturi cu activitate: verificare manuală",
      headingEn: "Accounts with activity: manual review",
      bodyRo: `Dacă pe cont există activitate înregistrată, ștergerea nu se poate face automat, dar dreptul dvs. la ștergere se aplică în continuare. Trimiteți o solicitare la ${privacyContactRo}. Solicitarea este analizată de personalul autorizat al platformei. Vă cerem doar informațiile necesare pentru a confirma că sunteți titularul contului; nu cerem copii ale actelor de identitate decât dacă există îndoieli rezonabile (art. 12 alin. (6) GDPR). Pentru fiecare categorie de date stabilim dacă o ștergem, o anonimizăm (de exemplu, eliminăm legătura cu dvs. a unui mesaj trimis altui utilizator sau a unei oferte dintr-o licitație încheiată) sau o păstrăm temporar, numai dacă se aplică o excepție prevăzută la art. 17 alin. (3) GDPR:
• o obligație legală (lit. b), de exemplu documentele contabile aferente plăților reale, păstrate pe perioada prevăzută de Legea contabilității nr. 82/1991; în versiunea POC plățile sunt doar de test, fără bani reali;
• constatarea, exercitarea sau apărarea unui drept în justiție (lit. e), de exemplu evidența unei licitații, a unei rezervări sau a unei sesizări privind conținut ilegal și a deciziei luate, cât timp acestea pot fi contestate.
Datele păstrate sunt folosite doar în scopul respectiv, cu acces restricționat, și sunt șterse când motivul păstrării încetează.`,
      bodyEn: `If your account has recorded activity, it cannot be deleted automatically, but your right to erasure still applies. Send a request to ${privacyContactEn}. Your request is reviewed by authorised platform staff. We ask only for the information needed to confirm that you hold the account; we do not ask for copies of identity documents unless there is reasonable doubt (GDPR Art. 12(6)). For each category of data we decide whether to erase it, anonymise it (for example, removing your link to a message sent to another user or to a bid in a closed auction), or keep it temporarily, only where an exception in GDPR Art. 17(3) applies:
• a legal obligation (point (b)), for example accounting records for real payments, kept for the period set by the Romanian Accounting Law no. 82/1991; in the POC version payments are test-only, with no real money;
• the establishment, exercise or defence of legal claims (point (e)), for example the record of an auction, a reservation, or an illegal-content report and the decision taken, while these can still be contested.
Data we keep is used only for that purpose, with restricted access, and is erased once the reason for keeping it ends.`,
    },
    {
      headingRo: "Termene și răspunsul nostru",
      headingEn: "Timelines and our response",
      bodyRo:
        "Ștergerea din cont are loc imediat după confirmare; copiile de siguranță ale bazei de date sunt suprascrise în ciclul normal. Răspundem solicitărilor fără întârzieri nejustificate și cel târziu în termen de o lună de la primire. Dacă solicitarea este complexă sau primim multe solicitări, termenul poate fi prelungit cu cel mult două luni; în acest caz vă anunțăm în prima lună, cu motivele (art. 12 alin. (3) GDPR). Vă comunicăm ce am șters, ce am anonimizat și ce am păstrat, cu temeiul și durata păstrării. Dacă nu dăm curs solicitării, integral sau parțial, vă comunicăm motivele în termen de o lună (art. 12 alin. (4) GDPR). Dacă datele au fost comunicate altor destinatari, îi informăm despre ștergere, cu excepția cazului în care acest lucru este imposibil sau implică eforturi disproporționate, și, la cerere, vă spunem cine sunt aceștia (art. 19 GDPR).",
      bodyEn:
        "In-app deletion takes effect immediately after you confirm; database backups are overwritten in the normal cycle. We respond to requests without undue delay and at the latest within one month of receipt. If a request is complex or we receive many requests, this may be extended by up to two further months; if so, we tell you within the first month, with the reasons (GDPR Art. 12(3)). We tell you what we erased, what we anonymised and what we kept, with the legal basis and how long it is kept. If we do not act on your request, in whole or in part, we tell you why within one month (GDPR Art. 12(4)). If your data was disclosed to other recipients, we inform them of the erasure unless this proves impossible or involves disproportionate effort, and on request we tell you who they are (GDPR Art. 19).",
    },
    {
      headingRo: "Dacă nu sunteți mulțumit",
      headingEn: "If you are not satisfied",
      bodyRo:
        "Aveți dreptul să depuneți o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP, www.dataprotection.ro) și dreptul de a vă adresa instanței de judecată (art. 77 și 79 GDPR).",
      bodyEn:
        "You have the right to lodge a complaint with the Romanian data protection authority, ANSPDCP (www.dataprotection.ro), and the right to an effective judicial remedy before the courts (GDPR Arts. 77 and 79).",
    },
  ];
}

export default function DataDeletionPage() {
  return (
    <LegalDocument
      titleRo="Instrucțiuni de ștergere a datelor (cerință Meta)"
      titleEn="Data deletion instructions (Meta requirement)"
      blocks={dataDeletionBlocks()}
    />
  );
}
