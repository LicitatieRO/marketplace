import { getListing } from '@/lib/server/catalogue';
import { isConfigured } from '@/lib/config';
import { failure,json } from '@/lib/server/http';
import { z } from 'zod';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;z.uuid().parse(id);const configured=isConfigured();const listing=await getListing(id);return json({data:listing&&!configured?{...listing,server_now:new Date().toISOString()}:listing,configured});}catch(e){return failure(e);}}
