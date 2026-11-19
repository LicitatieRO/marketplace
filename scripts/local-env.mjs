import { spawnSync } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const result=spawnSync('npx',['supabase','status','-o','json'],{encoding:'utf8'});
let settings;
if(result.status===0){try{settings=JSON.parse(result.stdout);}catch{}}
if(!settings){
  try{
    const local=JSON.parse(await readFile('.local-stack.json','utf8'));
    if(!local.localOnly)throw new Error('Not a local test stack.');
    settings={API_URL:local.apiUrl,ANON_KEY:local.anonKey,SERVICE_ROLE_KEY:local.serviceRoleKey};
  }catch{console.error('Start local Supabase or the documented lightweight test stack first. No credentials were printed.');process.exit(1);}
}
const url=settings.API_URL||settings.api_url;
const key=settings.ANON_KEY||settings.anon_key;
const secret=settings.SERVICE_ROLE_KEY||settings.service_role_key;
if(!url||!key||!secret||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('This helper only configures a local test backend.');
const password=process.env.E2E_PASSWORD||randomBytes(24).toString('base64url');
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
for(const [id,email,display_name]of [
 ['11111111-1111-4111-8111-111111111111','owner@licitatiero.local','Demo owner'],
 ['22222222-2222-4222-8222-222222222222','buyer@licitatiero.local','Demo buyer'],
 ['33333333-3333-4333-8333-333333333333','other@licitatiero.local','Other buyer'],
 ['44444444-4444-4444-8444-444444444444','dual@licitatiero.local','Dual persona'],
]){
 const {error}=await db.auth.admin.updateUserById(id,{password,email_confirm:true});
 if(error){const created=await db.auth.admin.createUser({id,email,password,email_confirm:true,user_metadata:{display_name}});if(created.error)throw new Error('Unable to configure a local test account.');}
}
const envBlock=`NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nSUPABASE_SECRET_KEY=${secret}\nAPP_URL=http://localhost:3000\nE2E_PASSWORD=${password}\nE2E_OWNER_EMAIL=owner@licitatiero.local\nE2E_BUYER_EMAIL=buyer@licitatiero.local\nPOC_OWNER_PASSWORD=${password}\nPOC_BUYER_PASSWORD=${password}\nPOC_DUAL_PASSWORD=${password}\n`;
await writeFile('.env.local',process.env.POC_SWITCHER_ENABLED==='true'?`${envBlock}POC_SWITCHER_ENABLED=true\n`:envBlock,{mode:0o600});
console.log('Local backend and four verified test accounts configured in ignored .env.local; password is not printed.');
