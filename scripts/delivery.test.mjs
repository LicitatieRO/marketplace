import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { detectSecrets } from './scan-secrets.mjs';
import { validateDeploymentConfig, verifyCiRuns, validateDbTarget } from './deploy.mjs';
import * as deployment from './deploy.mjs';
import { auditFindings } from './audit-dependencies.mjs';
const config = {VERCEL_TOKEN:'test', VERCEL_ORG_ID:'team_example', VERCEL_PROJECT_ID:'prj_example', SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst', DATABASE_URL:'postgresql://postgres:<test-password>@db.abcdefghijklmnopqrst.supabase.co:5432/postgres', DEPLOY_ORIGIN:'https://staging.example.com'};
test('secret scanner rejects actual credential forms without rejecting placeholders',()=>{
 assert.equal(detectSecrets('SUPABASE_SERVICE_ROLE_KEY=replace-me').length,0);
 assert.ok(detectSecrets('const x="'+'ghp_'+'x'.repeat(36)+'"').length);
 assert.ok(detectSecrets('-----BEGIN '+'PRIVATE KEY-----').length);
 assert.ok(detectSecrets('postgresql:'+'//postgres:realpassword@db.real.supabase.co/postgres').length);
 assert.ok(detectSecrets('SUPABASE_SERVICE_ROLE_KEY="'+'a'.repeat(45)+'"').length);
 assert.equal(detectSecrets('postgresql:'+'//postgres:postgres@127.0.0.1:54322/postgres').length,0);
 assert.ok(detectSecrets('postgresql:'+'//postgres:postgres@db.real.supabase.co/postgres').length);
});
test('deployment config fails closed and checks scoped database identity',()=>{
 assert.doesNotThrow(()=>validateDeploymentConfig(config));
 assert.throws(()=>validateDeploymentConfig({...config,VERCEL_TOKEN:''}),/VERCEL_TOKEN/);
 assert.throws(()=>validateDeploymentConfig({...config,DATABASE_URL:config.DATABASE_URL.replace('abcdefghijklmnopqrst','otherprojectabcdefgh')}),/project/);
 assert.throws(()=>validateDeploymentConfig({...config,DEPLOY_ORIGIN:'http://staging.example.com'}),/HTTPS/);
 assert.doesNotThrow(()=>validateDbTarget('postgresql://postgres.abcdefghijklmnopqrst:p@aws-0-eu-central-1.pooler.supabase.com:5432/postgres','abcdefghijklmnopqrst'));
});
test('child CLI subprocess env omits automation bypass secret',()=>{
 const env={...config,VERCEL_AUTOMATION_BYPASS_SECRET:'test-bypass',OTHER:'kept'};
 const child=deployment.childProcessEnv(env);
 assert.equal(child.VERCEL_AUTOMATION_BYPASS_SECRET,undefined);
 assert.equal('VERCEL_AUTOMATION_BYPASS_SECRET' in child,false);
 assert.equal(child.OTHER,'kept');
 assert.equal(child.VERCEL_TOKEN,config.VERCEL_TOKEN);
});
test('deployment config rejects bypass header injection without printing the value',()=>{
 for(const secret of ['test\r\nx-injected: value','test\nvalue','test\0value','   ']){
  assert.throws(()=>validateDeploymentConfig({...config,VERCEL_AUTOMATION_BYPASS_SECRET:secret}),error=>{
   assert.match(error.message,/VERCEL_AUTOMATION_BYPASS_SECRET/);
   assert.equal(error.message.includes(secret),false);
   return true;
  });
 }
});
test('all-protected deployment without a bypass secret fails before any migration or CLI write',()=>{
 const directory=mkdtempSync(join(tmpdir(),'deployment-preflight-'));
 const log=join(directory,'cli.log');
 const cwd=fileURLToPath(new URL('../',import.meta.url));
 const sha=execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim();
 writeFileSync(join(directory,'npx'),`#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.DEPLOY_TEST_CLI_LOG,'called\\n');\n`,{mode:0o755});
 const script=`import {deploy} from './scripts/deploy.mjs';
 globalThis.fetch=async url=>new Response(JSON.stringify(
  url.includes('/compare/')?{status:'identical'}:
  url.includes('/actions/')?{workflow_runs:[{head_sha:process.env.DEPLOY_SHA,status:'completed',conclusion:'success',head_branch:'main',event:'push'}]}:
  url.startsWith('https://api.vercel.com/')?{id:process.env.VERCEL_PROJECT_ID,accountId:process.env.VERCEL_ORG_ID,ssoProtection:{deploymentType:'all'}}:
  {status:'ok'}));
 try{await deploy();process.exitCode=2;}catch(error){console.log(error.message);}`;
 try{
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd,encoding:'utf8',env:{...process.env,...config,DEPLOY_SHA:sha,GITHUB_TOKEN:'test',GITHUB_REPOSITORY:'example/marketplace',VERCEL_AUTOMATION_BYPASS_SECRET:'',PATH:`${directory}:${process.env.PATH}`,DEPLOY_TEST_CLI_LOG:log}});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.equal(existsSync(log),false,'No migration or Vercel CLI command may run before protection preflight passes');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
async function healthServer(t,handler){
 const server=createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 return `http://127.0.0.1:${server.address().port}`;
}
test('protected health smoke sends the project bypass header to the health endpoint',async t=>{
 const origin=await healthServer(t,(request,response)=>{
  assert.equal(request.url,'/api/health');
  const authorized=request.headers['x-vercel-protection-bypass']==='test-bypass';
  response.writeHead(authorized?200:401,{'Content-Type':'application/json'});
  response.end(JSON.stringify({status:authorized?'ok':'unauthorized'}));
 });
 const options=deployment.deploymentHealthOptions({ssoProtection:{deploymentType:'all'}},'test-bypass');
 assert.equal(await deployment.checkDeploymentHealth(origin,options),true);
});
test('unprotected health smoke works without a bypass secret or header',async t=>{
 const origin=await healthServer(t,(request,response)=>{
  assert.equal(request.headers['x-vercel-protection-bypass'],undefined);
  response.writeHead(200,{'Content-Type':'application/json'});
  response.end('{"status":"ok"}');
 });
 for(const project of [{},{ssoProtection:null},{ssoProtection:{deploymentType:'preview'}}]){
  assert.equal(await deployment.checkDeploymentHealth(origin,deployment.deploymentHealthOptions(project)),true);
 }
});
test('protected health smoke does not forward its bypass secret across redirects',async t=>{
 let destinationRequests=0;
 const destination=await healthServer(t,(_request,response)=>{destinationRequests++;response.end('{"status":"ok"}');});
 const origin=await healthServer(t,(_request,response)=>{response.writeHead(302,{Location:`${destination}/api/health`});response.end();});
 const options=deployment.deploymentHealthOptions({ssoProtection:{deploymentType:'all'}},'test-bypass');
 assert.equal(await deployment.checkDeploymentHealth(origin,options),false);
 assert.equal(destinationRequests,0);
});
test('health smoke rejects unavailable responses and malformed or unhealthy JSON',async()=>{
 for(const [status,body] of [[401,'{"status":"ok"}'],[200,'<html>Sign in</html>'],[200,'{'],[200,'{"status":"unavailable"}'],[200,'null']]){
  assert.equal(await deployment.checkDeploymentHealth('https://staging.example.com',{},async()=>new Response(body,{status})),false);
 }
 assert.equal(await deployment.checkDeploymentHealth('https://staging.example.com',{},async()=>{throw new Error('Connection unavailable');}),false);
});
test('release requires exact SHA successful CI on main from push',()=>{
 const sha='a'.repeat(40); const run={head_sha:sha,conclusion:'success',status:'completed',head_branch:'main',event:'push'};
 assert.equal(verifyCiRuns([run],sha),true);
 for (const change of [{head_sha:'b'.repeat(40)},{conclusion:'failure'},{event:'pull_request'},{status:'in_progress'},{head_branch:'feature'}]) assert.equal(verifyCiRuns([{...run,...change}],sha),false);
});
test('audit fails on high findings absent an exact reviewed advisory baseline',()=>{
 const audit={vulnerabilities:{example:{severity:'high',via:[{source:123,title:'bad',url:'https://github.com/advisories/GHSA-abcd-efgh-ijkl'}]}}};
 assert.equal(auditFindings(audit,[]).length,1);
 assert.equal(auditFindings(audit,[{package:'example',advisory:'GHSA-abcd-efgh-ijkl',expires:'2099-01-01',reason:'reviewed exposure'}]).length,0);
 assert.equal(auditFindings(audit,[{package:'example',advisory:'GHSA-abcd-efgh-ijkl',expires:'2000-01-01',reason:'expired'}]).length,1);
});
