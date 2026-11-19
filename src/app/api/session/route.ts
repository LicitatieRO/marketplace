import { getViewer } from '@/lib/server/auth';
import { isConfigured } from '@/lib/config';
import { failure,json } from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(){try{return json({data:await getViewer(),configured:isConfigured()});}catch(e){return failure(e);}}
