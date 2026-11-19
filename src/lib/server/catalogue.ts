import 'server-only';
import { isConfigured } from '@/lib/config';
import type { Listing } from '@/lib/types';
import { demoListings } from '@/lib/fixtures';
import { sanitizeDemoListingsForClient, sanitizeDemoListingForClient } from '@/lib/server/demo-listing-client';
import { getSupabase } from './supabase';
export async function getCatalogue():Promise<Listing[]> {
 if(!isConfigured()) return sanitizeDemoListingsForClient(demoListings);
 const db=await getSupabase();const {data,error}=await db.rpc('get_catalogue');
 if(error) throw new Error('Unable to load properties. Please try again.');
 return (data||[]) as Listing[];
}
export async function getListing(id:string):Promise<Listing|null> {
 if(!isConfigured()) {
  const row=demoListings.find(l=>l.id===id)||null;
  return row ? sanitizeDemoListingForClient(row) : null;
 }
 const db=await getSupabase();const {data,error}=await db.rpc('get_listing',{p_listing_id:id});
 if(error) return null;
 return data as Listing|null;
}
