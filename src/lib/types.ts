export type Language = 'ro' | 'en';
export type TransactionType = 'sale' | 'rent';
export type AuctionMode = 'ascending' | 'sealed';
export interface Listing {
  id: string; property_id: string; owner_id?: string; title: string; description: string;
  neighborhood: string; judet?: string; property_type: string; transaction_type: TransactionType;
  price_minor: number; currency: string; area_sqm: number; rooms: number; floor: number;
  built_year: number; image_urls: string[]; tenancy_status: 'vacant'|'occupied';
  tour_url?: string|null;
  promo_expires_at?: string|null;
  status: string; auction_id: string|null; auction_mode: AuctionMode|null;
  auction_access: 'public'|'invite'|null; ends_at: string|null; starts_at: string|null;
  current_bid_minor: number|null; bid_count: number; min_increment_minor: number|null;
  starting_price_minor: number|null;
  /** Database timing sampled for display; acceptance always uses the locked database clock. */
  server_now?: string;
  initial_ends_at?: string|null;
  max_ends_at?: string|null;
  soft_close_seconds?: number|null;
  lat?: number;
  lng?: number;
  /** Stored public map pin (demo fallback only; never expose exact lat/lng). */
  publicLat?: number;
  publicLng?: number;
}
export interface Viewer { id: string; email: string; display_name: string; is_staff: boolean; aal: string; }
export interface Workspace { profile: Record<string,unknown>|null; properties: Record<string,unknown>[]; listings: Record<string,unknown>[]; property_promos?: Record<string,unknown>[]; auctions: Record<string,unknown>[]; bids: Record<string,unknown>[]; reservations: Record<string,unknown>[]; conversations: Record<string,unknown>[]; messages: Record<string,unknown>[]; viewings: Record<string,unknown>[]; favorites: string[]; }
export interface ApiResult<T> { data?: T; error?: string; }
