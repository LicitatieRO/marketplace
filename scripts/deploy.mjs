import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export function validateDbTarget(value,ref){
 const url=new URL(value);const direct=url.hostname===`db.${ref}.supabase.co`;const pool=/\.pooler\.supabase\.com$/.test(url.hostname)&&decodeURIComponent(url.username)===`postgres.${ref}`;
 if(!['postgres:','postgresql:'].includes(url.protocol)||(!direct&&!pool)||url.pathname!=='/postgres'||!url.password)throw new Error('DATABASE_URL must target the configured Supabase project and postgres database');
}
export function deploymentHealthOptions(project,secret){
 const configured=secret!==undefined&&secret!=='';
 if(configured&&(typeof secret!=='string'||!/^[\x21-\x7e]+$/.test(secret)))throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET must be a nonempty printable ASCII token without whitespace');
 if(project?.ssoProtection?.deploymentType==='all'&&!configured)throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required to smoke check this protected deployment');
 return configured?{headers:{'x-vercel-protection-bypass':secret},redirect:'error'}:{};
}
export async function checkDeploymentHealth(origin,options,fetchHealth=fetch){
 try{
  const response=await fetchHealth(`${origin}/api/health`,{...options,signal:AbortSignal.timeout(10000)});
  if(!response.ok)return false;
  const body=await response.json();return body?.status==='ok';
 }catch{return false;}
}
export function validateDeploymentConfig(env){
 const keys=['VERCEL_TOKEN','VERCEL_ORG_ID','VERCEL_PROJECT_ID','SUPABASE_PROJECT_REF','DATABASE_URL','DEPLOY_ORIGIN'];
 const missing=keys.filter(k=>!env[k]);if(missing.length)throw new Error(`Missing deployment configuration: ${missing.join(', ')}`);
 if(!/^team_[A-Za-z0-9]+$/.test(env.VERCEL_ORG_ID)||!/^prj_[A-Za-z0-9]+$/.test(env.VERCEL_PROJECT_ID))throw new Error('Expected explicit Vercel team and project IDs');
 if(!/^[a-z]{20}$/.test(env.SUPABASE_PROJECT_REF))throw new Error('Invalid SUPABASE_PROJECT_REF');
 validateDbTarget(env.DATABASE_URL,env.SUPABASE_PROJECT_REF);
 const origin=new URL(env.DEPLOY_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('DEPLOY_ORIGIN must be a clean HTTPS origin');
 deploymentHealthOptions(undefined,env.VERCEL_AUTOMATION_BYPASS_SECRET);
}
export function verifyCiRuns(runs,sha){return runs.some(r=>r.head_sha===sha&&r.status==='completed'&&r.conclusion==='success'&&r.head_branch==='main'&&r.event==='push');}
export function childProcessEnv(env){const child={...env};delete child.VERCEL_AUTOMATION_BYPASS_SECRET;return child;}
const run=(cmd,args,opts={})=>{try{return execFileSync(cmd,args,{stdio:'inherit',...opts});}catch(error){throw new Error(`${cmd} failed (exit ${error.status??'unknown'}); command arguments withheld because they may include credentials`);}};
export async function deploy(env=process.env){
 validateDeploymentConfig(env);const sha=env.DEPLOY_SHA;
 if(!/^[a-f0-9]{40}$/.test(sha??''))throw new Error('DEPLOY_SHA must be a full lowercase 40-character commit SHA');
 if(!env.GITHUB_TOKEN||!env.GITHUB_REPOSITORY)throw new Error('GitHub verification configuration missing');
 const api=async path=>{const r=await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`,{headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(!r.ok)throw new Error(`GitHub verification failed: ${r.status}`);return r.json();};
 const comparison=await api(`compare/${sha}...main`);
 if(!['ahead','identical'].includes(comparison.status))throw new Error('Commit is not reachable from main');
 const ci=await api(`actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`);
 if(!verifyCiRuns(ci.workflow_runs??[],sha))throw new Error('No successful completed main push CI run for this exact commit');
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();if(head!==sha)throw new Error('Checkout does not match verified deployment SHA');
 // Scope check against the authenticated Vercel API before any migration or deployment.
 const vr=await fetch(`https://api.vercel.com/v9/projects/${env.VERCEL_PROJECT_ID}?teamId=${env.VERCEL_ORG_ID}`,{headers:{Authorization:`Bearer ${env.VERCEL_TOKEN}`}});
 if(!vr.ok)throw new Error(`Vercel project/team preflight failed: ${vr.status}`);
 const project=await vr.json();if(project.id!==env.VERCEL_PROJECT_ID||project.accountId!==env.VERCEL_ORG_ID)throw new Error('Vercel project is outside configured team');
 const healthOptions=deploymentHealthOptions(project,env.VERCEL_AUTOMATION_BYPASS_SECRET);
 console.log(`Verified exact tested commit ${sha}; applying reviewed forward migrations.`);
 const cliEnv=childProcessEnv(env);
 run('npx',['--no-install','supabase','db','push','--db-url',env.DATABASE_URL,'--yes'],{env:cliEnv});
 const args=['--yes','vercel@65.15.0'];const auth=['--token',env.VERCEL_TOKEN,'--scope',env.VERCEL_ORG_ID];
 run('npx',[...args,'pull','--yes','--environment=production',...auth],{env:cliEnv});
 run('npx',[...args,'build','--prod',...auth],{env:cliEnv});
 run('npx',[...args,'deploy','--prebuilt','--prod',...auth],{env:cliEnv});
 for(let attempt=0;attempt<12;attempt++){
  if(await checkDeploymentHealth(env.DEPLOY_ORIGIN,healthOptions)){console.log('Deployment health smoke check passed');return;}
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 throw new Error('Deployment health smoke check failed; inspect deployment. Database rollback is never automatic.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await deploy();
