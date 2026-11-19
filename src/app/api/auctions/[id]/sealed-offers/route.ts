import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { databaseFailure, failure, json } from '@/lib/server/http';
import { parseSealedOffers } from '@/lib/sealed-offers';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireUser();
    const { id } = await params;
    z.uuid().parse(id);
    const { data, error } = await db.rpc('get_sealed_offers', { p_auction_id: id });
    return error ? databaseFailure(error) : json({ data: parseSealedOffers(data) });
  } catch (error) { return failure(error); }
}
