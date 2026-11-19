import { LegalDocument } from "@/components/disclosures/legal-document";
export const metadata = { title: "Cookie-uri POC" };
const blocks = [
  {
    headingRo: "Strict necesare",
    headingEn: "Strictly necessary",
    bodyRo:
      "Folosim cheile locale licitatiero-language și licitatiero-theme pentru limba și tema alese de dvs. Acestea sunt necesare pentru serviciul solicitat în browser și nu sunt folosite pentru publicitate.",
    bodyEn:
      "We use local keys licitatiero-language and licitatiero-theme for your chosen language and theme. These are necessary for the service you request in the browser and are not used for advertising.",
  },
  {
    headingRo: "Conținut opțional",
    headingEn: "Optional content",
    bodyRo:
      "Cheia licitatiero-optional-content memorează dacă acceptați încărcarea conținutului opțional (tururi 360° sau piese de hartă). Valoarea implicită este refuzul până la o alegere explicită. Puteți reveni la „Doar necesare” din Preferințe cookie (link în subsol) sau din bannerul de pe site.",
    bodyEn:
      "The key licitatiero-optional-content remembers whether you accept optional content (360° tours or map tiles). The default is refusal until you make an explicit choice. You can return to “Necessary only” via Cookie preferences in the footer or on the site banner.",
  },
  {
    headingRo: "Furnizori terți",
    headingEn: "Third-party providers",
    bodyRo:
      "Dacă acceptați conținut opțional, furnizorii de tur sau de hartă pot seta propriile cookie-uri. Lista efectivă depinde de URL-ul validat al turului sau de furnizorul de piese documentat în mediu.",
    bodyEn:
      "If you accept optional content, tour or map providers may set their own cookies. The actual list depends on the validated tour URL or the tile provider documented in the environment.",
  },
];
export default function LegalCookiesPage() {
  return (
    <LegalDocument
      titleRo="Politica de cookie-uri (POC)"
      titleEn="Cookie policy (POC)"
      blocks={blocks}
    />
  );
}