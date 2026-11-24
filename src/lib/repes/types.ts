/** Raw wire shapes from REPES list endpoints (tests use synthetic fixtures only). */
export type RepesMoney = { value: number; currency: string };

export type RepesAddress = {
  street?: string | null;
  streetNo?: string | null;
  flatNo?: string | null;
  apartmentNo?: string | null;
  gpsLocation?: string | null;
  postalCode?: string | null;
  county?: string | null;
  region?: string | null;
  city?: string | null;
  country?: string | null;
  originalAddress?: string | null;
};

export type RepesAsset = {
  id?: string;
  name?: string | null;
  type?: string;
  category?: string;
  address?: RepesAddress;
  description?: string | null;
  guarantee?: RepesMoney;
  price?: RepesMoney;
  properties?: Array<{ name?: string; value?: string }>;
};

export type RepesAuctionEntry = {
  id: string;
  caseId: string;
  date?: string;
  fileNo?: string;
  publicationNo?: string;
  publicationDate?: string;
  status?: string;
  address?: RepesAddress;
  asset?: RepesAsset;
  auctioneer?: {
    organisation?: {
      name?: string;
      description?: string | null;
      contactMethods?: Array<{ type?: string; value?: string }>;
    };
  };
};

export type RepesAuctionListResponse = {
  totalCount: number;
  entries: RepesAuctionEntry[];
};