import { timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabaseConfig } from '@/lib/config';
import { createOutboxSender,deliverBatch,resolveEmailDeliveryMode,type DeliveryEnv,type EmailContent,type OutboxItem } from '@/lib/notifications';
import { failure,json } from '@/lib/server/http';
import { requestOrigin,RequestError } from '@/lib/security';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
function authorized(request:Request){const expected=process.env.CRON_SECRET;const actual=request.headers.get('authorization')||'';if(!expected)return false;const a=Buffer.from(actual);const b=Buffer.from(`Bearer ${expected}`);return a.length===b.length&&timingSafeEqual(a,b);}
const row=z.object({id:z.union([z.string().regex(/^\d+$/),z.number().int().safe()]).transform(String),email:z.email(),event:z.string(),entity_id:z.string().nullable(),lease_token:z.uuid()});

async function storePreview(db:SupabaseClient,item:OutboxItem,content:EmailContent){
 const {data,error}=await db.rpc('store_notification_preview',{p_id:Number(item.id),p_lease_token:item.lease_token,p_subject:content.subject,p_body:content.text});
 if(error||data!==true) throw new Error('Preview store failed.');
}

export async function GET(request:Request){try{
 if(!authorized(request))throw new RequestError('Unauthorized worker request.',401);
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!secret)throw new RequestError('Configure worker credentials before enabling notifications.',503);
 const {url}=supabaseConfig();const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const origin=requestOrigin(request.url);
 const mode=resolveEmailDeliveryMode(process.env as DeliveryEnv,request.headers.get('host'));
 if(mode==='unavailable')throw new RequestError('Configure worker and email credentials before enabling notifications.',503);
 const from=process.env.EMAIL_FROM?.trim()||'notifications@example.test';
 const resendKey=process.env.RESEND_API_KEY?.trim()||'';
 const send=createOutboxSender(mode,{origin,from,resendApiKey:resendKey,storePreview:(item,content)=>storePreview(db,item,content)});
 const closed=await db.rpc('close_expired_auctions');if(closed.error)throw new Error('Expiry worker failed.');
 const claimed=await db.rpc('claim_notifications',{p_limit:5});if(claimed.error)throw new Error('Notification claim failed.');
 const items=z.array(row).parse(claimed.data);
 const result=await deliverBatch(items,send,async(item,delivered)=>{
  const {data,error}=await db.rpc('finish_notification',{p_id:item.id,p_lease_token:item.lease_token,p_delivered:delivered});
  if(error)throw new Error('Notification finalization failed.');return data===true;
 });
 return json({status:'ok',delivery_mode:mode,...result});
}catch(e){return failure(e);}}