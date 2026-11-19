import type { Listing } from "./types";

const unsplash = (photo: string) =>
  `https://images.unsplash.com/${photo}?w=1400&q=85&auto=format&fit=crop`;

const homes = [
  {
    judet: "București",
    neighborhood: "Floreasca",
    title:
      "Apartament 2 camere, 58 mp, Floreasca, 2022, parcare subterană — licitație (POC / Simulare)",
    description:
      "Apartament cu 2 camere, 58 mp utili, într-un imobil finalizat în 2022 pe partea de parc a cartierului Floreasca (Sector 1, pin de simulare lângă Parcul Floreasca — nu este o adresă reală). Etajul 5 din 8, orientare sud-est. Finisaje contemporane, clasă energetică A. Listare de simulare POC pentru LicitatieRO.",
    area: 58,
    rooms: 2,
    floor: 5,
    year: 2022,
    sale: 259000,
    rent: 750,
    type: "apartment",
    lat: 44.46463,
    lng: 26.09944,
    publicLat: 44.468,
    publicLng: 26.103,
    photos: [
      "photo-1600573472591-ee6b68d14c68",
      "photo-1600607687939-ce8a6c25118c",
    ],
  },
  {
    judet: "Ilfov",
    neighborhood: "Voluntari (Ilfov)",
    title:
      "Apartament nou 3 camere, 82 mp, Pipera–Voluntari, 2024, parcare — licitație (POC / Simulare)",
    description:
      "Apartament nou, 3 camere decomandate, 82 mp utili, într-un ansamblu finalizat în 2024 pe culoarul Pipera, în Voluntari (Ilfov). Pinul este o simulare de cluster — nu este o adresă reală de imobil. Listare de simulare POC.",
    area: 82,
    rooms: 3,
    floor: 3,
    year: 2024,
    sale: 335000,
    rent: 1150,
    type: "apartment",
    lat: 44.48625,
    lng: 26.11873,
    publicLat: 44.49,
    publicLng: 26.122,
    photos: [
      "photo-1600607687920-4e2a09cf159d",
      "photo-1600566753086-00f18fb6b3ea",
    ],
  },
  {
    judet: "București",
    neighborhood: "Unirii",
    title:
      "Apartament 2 camere, 64 mp, Unirii–Centrul Civic, renovat 2023 — licitație (POC / Simulare)",
    description:
      "Apartament cu 2 camere, 64 mp utili, în stocul civic de pe Bulevardul Unirii, Sector 3. Imobil 1986, reabilitat; apartamentul renovat în 2023. Pin de simulare. Listare de simulare POC.",
    area: 64,
    rooms: 2,
    floor: 6,
    year: 1986,
    sale: 224000,
    rent: 650,
    type: "apartment",
    lat: 44.42727,
    lng: 26.10797,
    publicLat: 44.431,
    publicLng: 26.112,
    photos: [
      "photo-1522708323590-d24dbb6b0267",
      "photo-1502672260266-1c1ef2d93688",
    ],
  },
  {
    judet: "București",
    neighborhood: "Tineretului",
    title:
      "Apartament 3 camere, 72 mp, Tineretului, lângă parc, renovat 2021 — licitație (POC / Simulare)",
    description:
      "Apartament cu 3 camere, 72 mp utili, în banda rezidențială de la nord de Parcul Tineretului, Sector 4. Imobil 1980; renovat în 2021. Listare de simulare POC.",
    area: 72,
    rooms: 3,
    floor: 3,
    year: 1980,
    sale: 203000,
    rent: 750,
    type: "apartment",
    lat: 44.4087,
    lng: 26.1056,
    publicLat: 44.412,
    publicLng: 26.109,
    photos: [
      "photo-1600566753190-17f0baa2a6c3",
      "photo-1600566752355-35792bedcfea",
    ],
  },
  {
    judet: "București",
    neighborhood: "Drumul Taberei",
    title:
      "Apartament 2 camere, 52 mp, Drumul Taberei, lângă metrou Favorit (M5) — licitație (POC / Simulare)",
    description:
      "Apartament tipic cu 2 camere, 52 mp utili, în Drumul Taberei, Sector 6, lângă stația Favorit (M5). Imobil 1982. Listare de simulare POC.",
    area: 52,
    rooms: 2,
    floor: 2,
    year: 1982,
    sale: 108000,
    rent: 450,
    type: "apartment",
    lat: 44.42554,
    lng: 26.04836,
    publicLat: 44.429,
    publicLng: 26.052,
    photos: [
      "photo-1600607688969-a5bfcd646154",
      "photo-1600566752734-2a0cd26c42ac",
    ],
  },
  {
    judet: "București",
    neighborhood: "Cotroceni",
    title:
      "Apartament 3 camere, 85 mp, Cotroceni, imobil 1938 renovat 2019 — licitație (POC / Simulare)",
    description:
      "Apartament cu 3 camere, 85 mp utili, în Cotroceni, Sector 5, într-un imobil interbelic din 1938, renovat în 2019. Pin de simulare, decalat față de Palatul Cotroceni. Listare de simulare POC.",
    area: 85,
    rooms: 3,
    floor: 2,
    year: 1938,
    sale: 287000,
    rent: 1050,
    type: "apartment",
    lat: 44.43013,
    lng: 26.07081,
    publicLat: 44.434,
    publicLng: 26.074,
    photos: [
      "photo-1600585154340-be6161a56a0c",
      "photo-1600210492486-724fe5c67fb0",
    ],
  },
];

export const demoListings: Listing[] = homes.flatMap((home, index) =>
  (["sale", "rent"] as const).map((transaction) => ({
    id: `${transaction === "sale" ? "2" : "3"}0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    property_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    owner_id: "11111111-1111-4111-8111-111111111111",
    title: home.title,
    description: home.description,
    neighborhood: home.neighborhood,
    judet: home.judet,
    property_type: home.type,
    transaction_type: transaction,
    price_minor: home[transaction] * 100,
    currency: "EUR",
    area_sqm: home.area,
    rooms: home.rooms,
    floor: home.floor,
    built_year: home.year,
    lat: home.lat,
    lng: home.lng,
    publicLat: home.publicLat,
    publicLng: home.publicLng,
    image_urls: home.photos.map((p) => unsplash(p)),
    tenancy_status: "vacant" as const,
    status: "active",
    auction_id:
      index === 0 && transaction === "sale"
        ? "40000000-0000-4000-8000-000000000001"
        : null,
    auction_mode:
      index === 0 && transaction === "sale" ? ("ascending" as const) : null,
    auction_access:
      index === 0 && transaction === "sale" ? ("public" as const) : null,
    starts_at: index === 0 ? new Date(Date.now() - 3600_000).toISOString() : null,
    ends_at: index === 0 ? new Date(Date.now() + 3 * 86_400_000).toISOString() : null,
    current_bid_minor: null,
    bid_count: index === 0 && transaction === "sale" ? 0 : 0,
    min_increment_minor: index === 0 && transaction === "sale" ? 100000 : null,
    starting_price_minor:
      index === 0 && transaction === "sale" ? 19900000 : null,
  })),
);