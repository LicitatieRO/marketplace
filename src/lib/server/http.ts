import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { RequestError } from '@/lib/security';
import type { Language } from '@/lib/types';
import {PublicValidationError,mapZodErrorToPublicValidation,publicValidationCodes,publicValidationMessage} from '@/lib/server/public-validation';
export function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export async function readJson(request:Request){
 if(!request.headers.get('content-type')?.includes('application/json')) throw new RequestError('JSON request body required.',415);
 const text=await request.text();if(text.length>32768)throw new RequestError('Request is too large.',413);
 try{return JSON.parse(text);}catch{throw new RequestError('Invalid JSON request.');}
}
type FailureOptions={language?:Language};
export function failure(error:unknown,options?:FailureOptions){
 const language=options?.language??'en';
 if(error instanceof PublicValidationError){
  if(!(publicValidationCodes as readonly string[]).includes(error.code))return json({error:'Invalid request.'},400);
  return json({error:publicValidationMessage(error.code,language)},error.status);
 }
 if(error instanceof RequestError){
  const safeServiceMessages=new Set([
   'Authenticator verification is temporarily unavailable.',
   'payments_unavailable',
   'Supabase is not configured. Connect a backend before saving changes.',
   'Configure worker credentials before enabling notifications.',
   'Configure worker and email credentials before enabling notifications.',
   'Photo storage is unavailable. Check the storage setup.',
   'APP_URL must be configured.',
   'HTTPS application origin required.',
   'Not available',
   'Reveal audit failed',
   'Accounts require a configured Supabase backend.',
   'Staging persona credentials are not configured.',
   'Accounts require a configured Supabase backend. See the setup guide.',
   'Unable to sign out. Please retry.',
  ]);
  const payload: { error: string; code?: string } = {
    error:
      error.status >= 500 && !safeServiceMessages.has(error.message)
        ? 'The request could not be completed. Please try again.'
        : error.message,
  };
  if (error.code) payload.code = error.code;
  return json(payload, error.status);
 }
 if(error instanceof ZodError){
  const mapped=mapZodErrorToPublicValidation(error);
  if(mapped)return json({error:publicValidationMessage(mapped.code,language)},mapped.status);
  return json({error:'Invalid request.'},400);
 }
 console.error('Request failed');
 return json({error:'The request could not be completed. Please try again.'},500);
}
export function databaseFailure(error:{code?:string;message?:string}){
 // Exact static database messages only; keyword matching can expose arbitrary private details.
 const safeMessages=new Set([
  'At least one positive price required',
  'Auction is not accepting bids',
  'Auction must expire first',
  'Auction not found',
  'Bid below minimum',
  'Bid not found',
  'Bid rate limit exceeded',
  'Future viewing required',
  'Highest bidder required',
  'Invalid MFA rate-limit request',
  'Invalid auction parameters',
  'Invalid bid amount',
  'Invalid reservation action',
  'Invalid viewing transition',
  'Listing not found',
  'Message length must be 1 to 3000',
  'Message rate limit exceeded',
  'Owner cannot bid',
  'Owner required',
  'Preview not found',
  'Prices must be positive',
  'Promotion already active for this property',
  'Property already has an active auction',
  'Property is reserved',
  'Recovery recipient email required',
  'Reservation is finalized',
  'Reservation not found',
  'Reservation party required',
  'Signup recipient email required',
  'Unsupported tour URL',
  'Verified bidder account required',
  'Verified email required',
  'Viewing party required',
  'Viewing rate limit exceeded',
 ]);
 const message=error.message||'';
 const expected=['P0001','42501','23505','23514'].includes(error.code||'');
 return json({error:expected&&safeMessages.has(message)?message:'This change is unavailable. Refresh and try again.'},error.code==='42501'?403:409);
}
