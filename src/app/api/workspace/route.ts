import { requireUser } from '@/lib/server/auth';
import { databaseFailure,failure,json } from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(){try{const {db}=await requireUser();const {data,error}=await db.rpc('get_workspace');return error?databaseFailure(error):json({data});}catch(e){return failure(e);}}
