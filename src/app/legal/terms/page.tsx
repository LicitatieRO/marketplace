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