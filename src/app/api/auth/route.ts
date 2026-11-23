import { after } from 'next/server';
import { assertSameOrigin,requestOrigin,RequestError,safeReturnPath } from '@/lib/security';
import { authInput } from '@/lib/validation';
import { getSupabase } from '@/lib/server/supabase';
import { isConfigured } from '@/lib/config';
import { failure,json,readJson } from '@/lib/server/http';
import { languageFromRequest } from '@/lib/server/public-validation';
import { isStagingSignupLinkEnabled } from '@/lib/server/staging-signup-link';
import {
  stagingExistingAccountOutboxNotice,
  stagingSignupWithOutboxLink,
} from '@/lib/server/staging-signup-outbox';
import { sendStandardExistingAccountNotice } from '@/lib/server/standard-signup-notice';
import {
  RECOVERY_GENERIC_MESSAGE,
} from '@/lib/server/recovery-response';
import {
  sendAppSentRecoveryEmail,
  sendLegacyPasswordRecoveryEmail,
} from '@/lib/server/recovery-email';
import { isAppSentRecoveryEnabled } from '@/lib/server/staging-recovery-link';
import {
  SIGNUP_CHECK_EMAIL_MESSAGE,
  SIGNUP_WEAK_PASSWORD_MESSAGE,
  hashSignupIdentifier,
  isSignupPasswordPolicyError,
  logSignupServerEvent,
  shouldScheduleExistingAccountNotice,
} from '@/lib/server/signup-response';
import {
  enforceAuthHttpRateLimit,
  peekAuthSignInRateLimit,
  recordAuthSignInFailure,
} from '@/lib/server/auth-rate-limit';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 const origin=requestOrigin(request.url);assertSameOrigin(request.headers,origin);
 if(!isConfigured())throw new RequestError('Accounts require a configured Supabase backend. See the setup guide.',503);
 const input=authInput.parse(await readJson(request));const db=await getSupabase();
 if(input.action==='logout'){const {error}=await db.auth.signOut({scope:'local'});if(error)throw new RequestError('Unable to sign out. Please retry.',503);return json({data:{message:'Signed out.'}});}
 if(input.action==='reset'){
  if(!input.password)throw new RequestError('A password with at least 12 characters is required.');
  const {data:{user}}=await db.auth.getUser();if(!user)throw new RequestError('Open the account recovery link first.',401);
  const {error}=await db.auth.updateUser({password:input.password});if(error)throw new RequestError('Password could not be changed. Request a new recovery link.');
  return json({data:{message:'Password updated.'}});
 }
 if(!input.email)throw new RequestError('Email is required.');
 const recoverEmail=input.email;
 if(input.action==='recover'){
  const limited=await enforceAuthHttpRateLimit(request.headers,'recover',recoverEmail);
  if(limited)return limited;
  const requestHost=request.headers.get('host');
  if(isAppSentRecoveryEnabled(requestHost)){
   after(()=>sendAppSentRecoveryEmail(recoverEmail,requestHost));
  }else{
   after(()=>sendLegacyPasswordRecoveryEmail(db,recoverEmail,origin));
  }
  return json({data:{message:RECOVERY_GENERIC_MESSAGE}});
 }
 if(!input.password)throw new RequestError('A password with at least 12 characters is required.');
 if(input.action==='signup'){
  const limited=await enforceAuthHttpRateLimit(request.headers,'signUp',input.email);
  if(limited)return limited;
  const requestHost=request.headers.get('host');
  const emailHash=hashSignupIdentifier(input.email);
  if(isStagingSignupLinkEnabled(requestHost)){
   const stagingResult=await stagingSignupWithOutboxLink({email:input.email,password:input.password,displayName:input.displayName,next:input.next,redirectTo:input.redirectTo});
   if(stagingResult.kind==='password_policy'){
    throw new RequestError(SIGNUP_WEAK_PASSWORD_MESSAGE);
   }
   if(stagingResult.kind==='existing_account'){
    after(()=>stagingExistingAccountOutboxNotice({email:stagingResult.email,emailHash:stagingResult.emailHash}));
   }
   return json({data:{message:SIGNUP_CHECK_EMAIL_MESSAGE}});
  }
  const nextPath=encodeURIComponent(safeReturnPath(input.next,input.redirectTo));
  const {data,error}=await db.auth.signUp({email:input.email,password:input.password,options:{data:{display_name:input.displayName||'Member'},emailRedirectTo:`${origin}/auth/callback?next=${nextPath}`}});
  if(error){
   if(isSignupPasswordPolicyError(error)){
    throw new RequestError(SIGNUP_WEAK_PASSWORD_MESSAGE);
   }
   logSignupServerEvent('standard_signup',{emailHash,reason:error.code??'signup_failed'});
  }
  if(shouldScheduleExistingAccountNotice(error,data)){
   after(()=>sendStandardExistingAccountNotice(input.email!,request.headers.get('host'),db,origin));
  }
  return json({data:{message:SIGNUP_CHECK_EMAIL_MESSAGE}});
 }
 const limited=await peekAuthSignInRateLimit(request.headers,input.email);
 if(limited)return limited;
 const {error}=await db.auth.signInWithPassword({email:input.email,password:input.password});
 if(error){
  await recordAuthSignInFailure(request.headers,input.email);
  throw new RequestError('Email or password is incorrect.',401);
 }
 return json({data:{message:'Signed in.'}});
}catch(e){return failure(e,{language:languageFromRequest(request.headers)});}}
