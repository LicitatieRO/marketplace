import { LegalDocument } from "@/components/disclosures/legal-document";
export const metadata = { title: "Termeni POC" };
const blocks = [
  {
    headingRo: "Natura platformei",
    headingEn: "Nature of the platform",
    bodyRo:
      "LicitatieRO, în această etapă, este un prototip de demonstrație (POC / Simulare). Licitațiile, ofertele, rezervările, depozitele și orice flux de plată sau promovare sunt simulate. Nu se percep taxe reale, nu există portofel, escrow sau custodie de fonduri imobiliare și nu se transferă proprietatea prin platformă.",
    bodyEn:
      "At this stage LicitatieRO is a proof-of-concept demonstration (POC / Simulation). Auctions, offers, reservations, deposits and any payment or promotion flows are simulated. There are no real charges, no wallet, no escrow or custody of property funds, and no transfer of title through the platform.",
  },
  {
    headingRo: "Fără transfer de proprietate",
    headingEn: "No transfer of title",
    bodyRo:
      "Rezervarea pe platformă nu este arvună (Cod civil art. 1544), nu înlocuiește forma autentică (art. 1244) și nu produce înscriere în Cartea Funciară (art. 885). Contractele imobiliare și actele notariale se încheiază în afara platformei.",
    bodyEn:
      "A platform reservation is not earnest money (Romanian Civil Code art. 1544), does not replace authentic form (art. 1244) and does not create Land Book registration (art. 885). Real-estate contracts and notarial deeds are concluded outside the platform.",
  },
  {
    headingRo: "Conturi și verificare",
    headingEn: "Accounts and verification",
    bodyRo:
      "Confirmarea adresei de e-mail este o verificare demonstrativă. Nu constituie KYC/AML, nu folosește ROeID și nu atestă dreptul de proprietate.",
    bodyEn:
      "Email confirmation is a demonstration check only. It is not KYC/AML, does not use ROeID, and does not prove ownership of any property.",
  },
  {
    anchorId: "how-we-rank-listings",
    headingRo: "Cum ordonăm anunțurile",
    headingEn: "How we rank listings",
    bodyRo:
      "Opțiunea „Implicit” păstrează ordinea primită de la server (identificatorul anunțului), nu un scor de calitate sau o recomandare personalizată. Puteți sorta după preț sau suprafață. O promovare, inclusiv o previzualizare de test, este marcată cu eticheta „Promovat” și, în acest moment, nu modifică poziția în listă.",
    bodyEn:
      "The “Default” option keeps the order received from the server (the listing identifier). It is not a quality score or a personalised recommendation. You can also sort by price or area. A promotion, including a test preview, is marked “Promoted” and, at this time, does not change position in the list.",
  },
];
export default function LegalTermsPage() {
  return (
    <LegalDocument
      titleRo="Termeni de utilizare (POC)"
      titleEn="Terms of use (POC)"
      blocks={blocks}
    />
  );
}
