import { getCatalogue } from '@/lib/server/catalogue';
import { isConfigured } from '@/lib/config';
import { failure,json } from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(){try{return json({data:await getCatalogue(),configured:isConfigured()});}catch(e){return failure(e);}}
