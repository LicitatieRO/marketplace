import { z } from 'zod';
import { isValidJudet } from './judet';
const id = z.uuid();
const money = z.number().int().positive().max(1_000_000_000_000);
const when = z.iso.datetime({ offset: true });
const picture = z.url().refine(v => {const u=new URL(v); return (u.protocol==='https:' && (u.hostname==='images.unsplash.com'||u.hostname==='images.pexels.com'||u.hostname.endsWith('.supabase.co'))) || (u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)&&u.port==='54321'&&u.pathname.startsWith('/storage/v1/object/public/listing-media/'));},'Use approved HTTPS image hosting.');
const propertyFields = z.object({p_title:z.string().trim().min(5).max(160),p_description:z.string().trim().min(20).max(5000),p_neighborhood:z.string().trim().min(2).max(100),p_exact_address:z.string().trim().min(5).max(300),p_property_type:z.enum(['apartment','house','studio','land','commercial']),p_area_sqm:z.number().int().min(5).max(100000),p_rooms:z.number().int().min(1).max(100),p_floor:z.number().int().min(-3).max(150),p_built_year:z.number().int().min(1700).max(2100),p_sale_price_minor:money.nullable().default(null),p_rent_price_minor:money.nullable().default(null),p_image_urls:z.array(picture).max(12).default([]),p_judet:z.string().trim().min(2).max(40).default('București'),p_lat:z.number().min(43.47).max(48.42).nullable().optional(),p_lng:z.number().min(20.11).max(30.2).nullable().optional()}).strict().refine(v=>v.p_sale_price_minor!==null||v.p_rent_price_minor!==null,'Enter a sale or rental price.').refine(v=>isValidJudet(v.p_judet),'Invalid judet.');
const payloads = {
 create_property: propertyFields,
 update_property: propertyFields.safeExtend({p_property_id:id}),
 start_auction: z.object({p_listing_id:id,p_mode:z.enum(['ascending','sealed']),p_access:z.enum(['public','invite']),p_starts_at:when,p_ends_at:when,p_starting_price_minor:money.nullable(),p_min_increment_minor:money}).strict().refine(v=>Date.parse(v.p_ends_at)>Date.parse(v.p_starts_at),'Closing time must follow start.'),
 place_bid:z.object({p_auction_id:id,p_amount_minor:money,p_idempotency_key:id}).strict(),
 invite_bidder:z.object({p_auction_id:id,p_email:z.email().max(254)}).strict(),
 request_reservation:z.object({p_bid_id:id,p_deposit_minor:money,p_idempotency_key:id}).strict(),
 advance_reservation:z.object({p_reservation_id:id,p_action:z.enum(['fund','cancel','sign']),p_idempotency_key:id}).strict(),
 request_viewing:z.object({p_listing_id:id,p_requested_at:when,p_message:z.string().trim().max(2000)}).strict(),
 update_viewing:z.object({p_viewing_id:id,p_status:z.enum(['confirmed','cancelled'])}).strict(),
 send_message:z.object({p_listing_id:id,p_body:z.string().trim().min(1).max(3000),p_conversation_id:id.nullable().optional()}).strict(),
 set_property_tour:z.object({p_property_id:id,p_tour_url:z.url().max(800).refine(v=>{const u=new URL(v);return u.protocol==='https:'&&((['kuula.co','www.kuula.co'].includes(u.hostname)&&u.pathname.startsWith('/share/'))||(u.hostname==='my.matterport.com'&&u.pathname==='/show/'&&Boolean(u.searchParams.get('m'))));}).nullable()}).strict(),
 set_favorite:z.object({p_listing_id:id,p_saved:z.boolean()}).strict(),
};
export type MutationAction = keyof typeof payloads;
export function parseMutation(value:unknown):{action:MutationAction;payload:Record<string,unknown>} {
 const input=z.object({action:z.enum(Object.keys(payloads) as [MutationAction,...MutationAction[]]),payload:z.record(z.string(),z.unknown())}).strict().parse(value);
 return {action:input.action,payload:payloads[input.action].parse(input.payload)};
}
export const authInput=z.object({action:z.enum(['login','signup','logout','recover','reset']),email:z.email().max(254).optional(),password:z.string().min(12).max(128).optional(),displayName:z.string().trim().min(2).max(100).optional(),next:z.string().max(2048).optional(),redirectTo:z.string().max(2048).optional()}).strict();
