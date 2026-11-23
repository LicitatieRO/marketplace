import type { Language, Listing } from "./types";
export const translate = (language: Language, ro: string, en: string) =>
  language === "ro" ? ro : en;
export function listingTitle(listing: Listing, language: Language) {
  if (language === "ro" || !listing.property_id.startsWith("10000000-"))
    return listing.title;
  const titles: Record<string, string> = {
    Cotroceni: "A quiet corner of old Bucharest",
    Dorobanți: "Light, space, and a little elegance",
    Floreasca: "Life by the park",
    Tineretului: "Your first place, with room to grow",
    Aviației: "A new perspective on city living",
    Unirii: "The city, right on your doorstep",
  };
  return titles[listing.neighborhood] || listing.title;
}
export function listingDescription(listing: Listing, language: Language) {
  if (language === "ro" || !listing.property_id.startsWith("10000000-"))
    return listing.description;
  return "A thoughtfully arranged home in one of Bucharest’s most loved neighborhoods. Generous natural light, useful living spaces, and easy access to the places that make everyday life feel good. Ask the owner for details or arrange a viewing. The location shown is approximate.";
}
export function localizedMessage(message: string, language: Language): string {
  if (language === "en") return message;
  const messages: Record<string, string> = {
    "Signed in.": "Ai intrat în cont.",
    "Signed out.": "Ai ieșit din cont.",
    "Password updated.": "Parola a fost actualizată.",
    "If this address has an account, a recovery email will arrive shortly.":
      "Dacă adresa are un cont, vei primi în curând un email de recuperare.",
    "Check your email to verify your account before bidding.":
      "Verifică emailul pentru confirmarea contului înainte de a participa.",
    "Email or password is incorrect.": "Emailul sau parola nu sunt corecte.",
    "A password with at least 12 characters is required.":
      "Parola trebuie să aibă cel puțin 12 caractere.",
    "Choose a stronger password.": "Alege o parolă mai puternică.",
    "Open the account recovery link first.":
      "Deschide mai întâi linkul de recuperare primit prin email.",
    "Password could not be changed. Request a new recovery link.":
      "Parola nu a putut fi schimbată. Solicită un link nou de recuperare.",
    "Unable to create an account. Check your details or try account recovery.":
      "Contul nu a putut fi creat. Verifică datele sau încearcă recuperarea contului.",
    "Sign in to continue.": "Intră în cont pentru a continua.",
    "Verify your email before making changes.":
      "Confirmă adresa de email înainte de a salva modificări.",
    "Verified email required": "Este necesară o adresă de email confirmată.",
    "Owner required": "Doar proprietarul poate face această modificare.",
    "Property already has an active auction":
      "Proprietatea are deja o licitație activă sau programată.",
    "Property is reserved": "Proprietatea are o rezervare activă.",
    "At least one positive price required":
      "Completează cel puțin un preț pozitiv.",
    "Enter a sale or rental price.":
      "Completează un preț de vânzare sau de închiriere.",
    "Prices must be positive": "Prețurile trebuie să fie pozitive.",
    "Unsupported image URL":
      "Un URL de fotografie nu este acceptat. Folosește o gazdă aprobată.",
    "Use approved HTTPS image hosting.":
      "Folosește URL-uri HTTPS de pe gazdele de imagini aprobate.",
    "Listing is closed": "Anunțul este închis.",
    "Invalid auction parameters": "Verifică prețurile și perioada licitației.",
    "Closing time must follow start.":
      "Închiderea trebuie să fie după începerea licitației.",
    "Auction not found": "Licitația nu a fost găsită.",
    "Owner cannot bid": "Proprietarul nu poate licita la propria proprietate.",
    "Invitation required": "Ai nevoie de o invitație pentru a participa.",
    "Auction is not accepting bids":
      "Licitația nu mai acceptă oferte sau nu a început încă.",
    "Invalid bid amount": "Introdu o valoare pozitivă pentru ofertă.",
    "Bid below minimum":
      "Oferta este sub minimul acceptat. Reîncarcă pentru valoarea actuală.",
    "Bid rate limit exceeded":
      "Ai trimis prea multe oferte. Așteaptă un minut.",
    "Verified bidder account required":
      "Invitația necesită un cont de participant cu email confirmat.",
    "Auction must expire first":
      "Poți selecta o ofertă doar după închiderea licitației.",
    "Highest bidder required":
      "La o licitație ascendentă poți selecta doar oferta cea mai mare.",
    "Invalid simulated deposit":
      "Depozitul simulat trebuie să fie pozitiv și cel mult egal cu oferta.",
    "Reservation is finalized": "Rezervarea este deja finalizată.",
    "Applicant funding required":
      "Doar cumpărătorul sau chiriașul poate finanța simularea.",
    "Fund simulation before signing":
      "Finanțează simularea înainte de confirmarea semnării.",
    "Future viewing required": "Alege o vizionare în următoarele 90 de zile.",
    "Available listing required":
      "Anunțul trebuie să fie disponibil și să aparțină altui proprietar.",
    "Invalid viewing transition":
      "Această modificare a vizionării nu este disponibilă.",
    "Message length must be 1 to 3000":
      "Mesajul trebuie să aibă între 1 și 3.000 de caractere.",
    "Message rate limit exceeded":
      "Ai trimis prea multe mesaje. Așteaptă un minut.",
    "This change is unavailable. Refresh and try again.":
      "Modificarea nu este disponibilă. Reîncarcă pagina și încearcă din nou.",
    "The request could not be completed. Please try again.":
      "Cererea nu a putut fi finalizată. Încearcă din nou.",
    "Too many attempts. Please try again later.":
      "Prea multe încercări. Încearcă din nou mai târziu.",
    "Service temporarily unavailable. Please try again shortly.":
      "Serviciul este temporar indisponibil. Încearcă din nou în curând.",
    "Invalid or expired authenticator code.":
      "Codul autentificatorului este incorect sau a expirat.",
    "Upload a JPG, PNG or WebP smaller than 3 MB.":
      "Încarcă o fotografie JPG, PNG sau WebP mai mică de 3 MB.",
    "Upload one image smaller than 3 MB.":
      "Încarcă o singură fotografie mai mică de 3 MB.",
    "Only still JPG, PNG and WebP photographs are supported.":
      "Sunt acceptate doar fotografii statice JPG, PNG sau WebP.",
    "Photo storage is unavailable. Check the storage setup.":
      "Stocarea fotografiilor este indisponibilă. Verifică configurarea.",
    "Failed to fetch":
      "Conexiunea a fost întreruptă. Reîncearcă aceeași acțiune.",
    "Staff accounts cannot be deleted here.":
      "Conturile de echipă nu pot fi șterse din această interfață.",
    "Close your published listings, active auctions, open bids, reservations, promotions, or content reports linked to your email before deleting your account.":
      "Închide anunțurile publicate, licitațiile active, ofertele deschise, rezervările, promovările sau sesizările legate de email înainte de a șterge contul.",
    "Type your account email or ȘTERGE / DELETE to confirm.":
      "Tastează adresa de email sau ȘTERGE / DELETE pentru confirmare.",
    "Your explanation must be at least 30 characters.":
      "Explicația trebuie să aibă cel puțin 30 de caractere.",
    "Enter a valid email address.": "Introdu o adresă de email validă.",
    "This required field is missing.": "Completează acest câmp obligatoriu.",
    "Invalid request.": "Cerere invalidă.",
  };
  return messages[message] || message;
}

/** Marketing and pitch-polish copy (RO primary + EN). */
export const pocBannerCollapsedLine = {
  ro: "POC / Simulare · Fără bani reali",
  en: "POC / Simulation · No real money",
};
export const pocBannerExpandLabel = { ro: "Detalii", en: "Details" };
export const pocBannerCollapseLabel = { ro: "Restrânge", en: "Collapse" };
export const heroSubline = {
  ro: "Licitații simulate (POC) pentru locuințe din București: explorezi anunțuri demonstrative, fără cumpărare, închiriere sau plăți reale.",
  en: "Simulated auctions (POC) for Bucharest homes: explore demonstration listings, with no real purchase, rental, or payment.",
};
export const heroMapCta = { ro: "Vezi harta", en: "See the map" };
export const demoSwitcherChipLabel = { ro: "Demo", en: "Demo" };
export const mapToolbarSettingsChip = { ro: "Setări hartă", en: "Map settings" };
export const mapSearchOnMoveLabel = {
  ro: "Caută când muți harta",
  en: "Search as I move the map",
};
export const mapFilterChipBuy = { ro: "Cumpără", en: "Buy" };
export const mapFilterChipRent = { ro: "Închiriază", en: "Rent" };
export const openGraphImageTagline = {
  ro: "Licitații de locuințe în București · POC",
  en: "Bucharest home auctions · POC",
};
export const openGraphImageBrand = { ro: "LicitatieRO", en: "LicitatieRO" };
