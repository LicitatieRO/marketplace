import { assertSameOrigin,requestOrigin } from '@/lib/security';
import { parseMutation } from '@/lib/validation';
import { requireUser } from '@/lib/server/auth';
import { databaseFailure,failure,json,readJson } from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 assertSameOrigin(request.headers,requestOrigin(request.url));
 const {action,payload}=parseMutation(await readJson(request));
 const {db}=await requireUser();const {data,error}=await db.rpc(action,payload);
 return error?databaseFailure(error):json({data});
}catch(e){return failure(e);}}
