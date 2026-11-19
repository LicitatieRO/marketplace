import {
  buildContentSecurityPolicy,
  createContentSecurityPolicyNonce,
  CSP_NONCE_HEADER,
} from '@/lib/content-security-policy';
import { requestIdFor } from '@/lib/server/request-id';
import { createServerClient } from '@supabase/ssr';
import { NextResponse,type NextRequest } from 'next/server';
import { isConfigured,supabaseConfig } from '@/lib/config';
export async function proxy(request:NextRequest){
 const requestId=requestIdFor(request.headers.get('x-request-id'));
 const nonce=createContentSecurityPolicyNonce();
 const isDev=process.env.NODE_ENV==='development';
 const csp=buildContentSecurityPolicy({nonce,isDev});
 const requestHeaders=new Headers(request.headers);
 requestHeaders.set('x-request-id',requestId);
 requestHeaders.set(CSP_NONCE_HEADER,nonce);
 requestHeaders.set('Content-Security-Policy',csp);
 const nextResponse=()=>{const result=NextResponse.next({request:{headers:requestHeaders}});result.headers.set('x-request-id',requestId);result.headers.set('Content-Security-Policy',csp);return result;};
 let response=nextResponse();
 if(!isConfigured())return response;
 const {url,key}=supabaseConfig();
 const secure=(process.env.APP_URL||'https://').startsWith('https:');
 const db=createServerClient(url,key,{auth:{flowType:'pkce'},cookieOptions:{httpOnly:true,sameSite:'lax',secure,path:'/'},cookies:{getAll(){return request.cookies.getAll();},setAll(values){for(const{name,value}of values)request.cookies.set(name,value);response=nextResponse();for(const{name,value,options}of values)response.cookies.set(name,value,{...options,httpOnly:true,sameSite:'lax',secure});}}});
 // Verify before using identity; this also rotates stale session cookies.
 if(request.cookies.getAll().some(c=>c.name.startsWith('sb-')))await db.auth.getUser();
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)']};
