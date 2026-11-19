import 'server-only';
import { cache } from 'react';
import { isConfigured } from '@/lib/config';
import { RequestError } from '@/lib/security';
import type { Viewer } from '@/lib/types';
import { getSupabase } from './supabase';
export const getViewer=cache(async():Promise<Viewer|null>=>{
 if(!isConfigured()) return null;
 const db=await getSupabase();const {data:{user},error}=await db.auth.getUser();
 if(error||!user) return null;
 const [{data:workspace},{data:claims}]=await Promise.all([db.rpc('get_workspace'),db.auth.getClaims()]);
 const profile=workspace?.profile;
 return {id:user.id,email:user.email||'',display_name:profile?.display_name||String(user.user_metadata?.display_name||''),is_staff:profile?.is_staff===true,aal:String(claims?.claims?.aal||'aal1')};
});
export async function requireUser(){
 if(!isConfigured()) throw new RequestError('Supabase is not configured. Connect a backend before saving changes.',503);
 const db=await getSupabase();const {data:{user},error}=await db.auth.getUser();
 if(error||!user) throw new RequestError('Sign in to continue.',401);
 if(!user.email_confirmed_at) throw new RequestError('Verify your email before making changes.',403);
 return {db,user};
}
export async function requireSignedInUser(){
 if(!isConfigured()) throw new RequestError('Supabase is not configured. Connect a backend before saving changes.',503);
 const db=await getSupabase();const {data:{user},error}=await db.auth.getUser();
 if(error||!user) throw new RequestError('Sign in to continue.',401);
 return {db,user};
}
