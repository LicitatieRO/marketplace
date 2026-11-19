/** Minimal local-only GoTrue/PostgREST harness. Normal CI uses the Supabase CLI. */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes,createHmac,createHash } from 'node:crypto';
import { readFile,writeFile,mkdir,readdir,chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const runtime=path.join(root,'dev/lightweight/.runtime');
const configPath=path.join(root,'.local-stack.json');
const names={db:'licitatiero-local-db',auth:'licitatiero-local-auth',rest:'licitatiero-local-rest'};
const docker=(args,optional=false)=>{const r=spawnSync('docker',args,{encoding:'utf8'});if(r.status!==0&&!optional)throw new Error(`Docker ${args[0]} failed; inspect named local containers. Credentials not printed.`);return r;};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function settings(){try{return JSON.parse(await readFile(configPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw new Error('Local credentials file is unreadable or malformed; refusing to replace it.');const jwtSecret=randomBytes(48).toString('hex'),dbPassword=randomBytes(32).toString('hex');const token=role=>{const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const body=Buffer.from(JSON.stringify({iss:'supabase',role,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+365*86400})).toString('base64url');return `${head}.${body}.${createHmac('sha256',jwtSecret).update(`${head}.${body}`).digest('base64url')}`;};const value={apiUrl:'http://127.0.0.1:54321',databaseUrl:`postgres://postgres:${dbPassword}@127.0.0.1:54322/postgres`,dbPassword,jwtSecret,anonKey:token('anon'),serviceRoleKey:token('service_role'),localOnly:true};await writeFile(configPath,JSON.stringify(value,null,2),{mode:0o600});return value;}}
async function envFile(name,values){const filename=path.join(runtime,name+'.env');await writeFile(filename,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});return filename;}
function container(name,image,port,inside,env){if(docker(['container','inspect',name],true).status===0){docker(['start',name]);return;}docker(['run','-d','--name',name,'--network','licitatiero-local','--env-file',env,'-p',`127.0.0.1:${port}:${inside}`,...(name===names.db?['-v','licitatiero-local-db:/var/lib/postgresql/data']:[]),image]);}
async function connect(config){for(let attempt=0;attempt<60;attempt++){const client=new pg.Client({connectionString:config.databaseUrl});try{await client.connect();return client;}catch{await client.end().catch(()=>{});await sleep(500);}}throw new Error('Local Postgres did not become ready.');}
async function healthy(url,headers={}){for(let attempt=0;attempt<90;attempt++){try{const response=await fetch(url,{headers,signal:AbortSignal.timeout(2000)});if(response.ok)return;}catch{}await sleep(500);}throw new Error('Local service health check failed. Inspect local auth/rest container logs; never share tokens.');}
async function migrate(client){const files=(await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort();for(const name of files){const sql=await readFile(path.join('supabase/migrations',name),'utf8');const sha=createHash('sha256').update(sql).digest('hex');const existing=await client.query('SELECT sha256 FROM local_stack.migrations WHERE name=$1',[name]);if(existing.rowCount){if(existing.rows[0].sha256!==sha)throw new Error(`Migration ${name} changed after application; create a new local stack explicitly.`);continue;}await client.query('BEGIN');try{await client.query(sql);await client.query('INSERT INTO local_stack.migrations(name,sha256) VALUES($1,$2)',[name,sha]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}}const seeded=await client.query("SELECT 1 FROM local_stack.migrations WHERE name='seed'");if(!seeded.rowCount){await client.query('BEGIN');try{await client.query(await readFile('supabase/seed.sql','utf8'));await client.query("INSERT INTO local_stack.migrations(name,sha256) VALUES('seed','local-demo')");await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}}await client.query("NOTIFY pgrst,'reload schema'");}
async function main(){const command=process.argv[2]??'start';await mkdir(runtime,{recursive:true,mode:0o700});
 if(command==='stop'){try{const pid=Number(await readFile(path.join(runtime,'gateway.pid'),'utf8'));const cmd=await readFile(`/proc/${pid}/cmdline`,'utf8');if(cmd.includes('scripts/local-gateway.mjs'))process.kill(pid,'SIGTERM');}catch{}for(const name of Object.values(names))docker(['stop',name],true);console.log('Local integration harness stopped; data retained.');return;}
 if(command!=='start'&&command!=='migrate')throw new Error('Usage: node scripts/local-stack.mjs start|migrate|stop');
 const config=await settings();await chmod(configPath,0o600);
 if(!/^[a-f0-9]{64}$/.test(config.dbPassword))throw new Error('Invalid generated local database credential format.');
 const existingDb=process.env.LOCAL_STACK_EXISTING_DB;
 if(existingDb){
 if(existingDb!=='licitatiero-test-db')throw new Error('Only the explicitly authorized local test DB container may be reused.');
 const sql=`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='licitatiero_local_admin') THEN CREATE ROLE licitatiero_local_admin LOGIN SUPERUSER; END IF; END $$; ALTER ROLE licitatiero_local_admin PASSWORD '${config.dbPassword}';`;
 const provision=spawnSync('docker',['exec','-i',existingDb,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});if(provision.status!==0)throw new Error('Could not prepare isolated local admin role.');
 const found=docker(['exec',existingDb,'psql','-U','postgres','-tAc',"SELECT 1 FROM pg_database WHERE datname='licitatiero_app'"]);
 if(!found.stdout.trim())docker(['exec',existingDb,'createdb','-U','postgres','-O','licitatiero_local_admin','licitatiero_app']);
 config.databaseUrl=`postgres://licitatiero_local_admin:${config.dbPassword}@127.0.0.1:54329/licitatiero_app`;config.databaseHost=existingDb;config.databaseName='licitatiero_app';config.reusesExistingTestCluster=true;await writeFile(configPath,JSON.stringify(config,null,2),{mode:0o600});
 }
 const dbHost=config.databaseHost??names.db,dbName=config.databaseName??'postgres';
 if(command==='start'){
 docker(['network','create','licitatiero-local'],true);
 if(existingDb){docker(['network','connect','licitatiero-local',existingDb],true);}else{
 const dbEnv=await envFile('postgres',{POSTGRES_PASSWORD:config.dbPassword,POSTGRES_DB:'postgres'});
 container(names.db,'postgres:17-bookworm',54322,5432,dbEnv);
 }
 }
 const client=await connect(config);
 try{
 await client.query(await readFile('dev/lightweight/bootstrap.sql','utf8'));
 // Random hexadecimal password has no SQL quotes; never accepts supplied shell values.
 if(!/^[a-f0-9]{64}$/.test(config.dbPassword))throw new Error('Invalid generated local database credential format.');
 await client.query(`ALTER ROLE authenticator PASSWORD '${config.dbPassword}'; ALTER ROLE supabase_auth_admin PASSWORD '${config.dbPassword}';`);
 if(command==='start'){
 const authEnv=await envFile('auth',{GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:9999,API_EXTERNAL_URL:config.apiUrl,GOTRUE_SITE_URL:'http://localhost:3000',GOTRUE_URI_ALLOW_LIST:'http://localhost:3000/**',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${config.dbPassword}@${dbHost}:5432/${dbName}`,GOTRUE_JWT_SECRET:config.jwtSecret,GOTRUE_JWT_EXP:3600,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_EXTERNAL_EMAIL_ENABLED:true,GOTRUE_MAILER_AUTOCONFIRM:true,GOTRUE_DISABLE_SIGNUP:false,GOTRUE_RATE_LIMIT_EMAIL_SENT:100,GOTRUE_SMS_AUTOCONFIRM:false});
 container(names.auth,'supabase/gotrue:v2.197.0',54323,9999,authEnv);
 await healthy('http://127.0.0.1:54323/health');
 // Initial GoTrue migrations define legacy claim helpers; restore JSON-claims helpers for PostgREST14.
 await client.query(await readFile('dev/lightweight/bootstrap.sql','utf8')); 
 }
 await migrate(client);
 if(command==='start'){
 const restEnv=await envFile('rest',{PGRST_DB_URI:`postgres://authenticator:${config.dbPassword}@${dbHost}:5432/${dbName}`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_DB_EXTRA_SEARCH_PATH:'public,extensions',PGRST_JWT_SECRET:config.jwtSecret,PGRST_SERVER_PORT:3000});
 container(names.rest,'postgrest/postgrest:v14.18',54324,3000,restEnv);
 await healthy('http://127.0.0.1:54324/',{Authorization:`Bearer ${config.anonKey}`});
 let gatewayReady=false;try{const response=await fetch(config.apiUrl+'/health');gatewayReady=response.ok;}catch{}
 if(!gatewayReady){const gateway=spawn(process.execPath,['scripts/local-gateway.mjs'],{cwd:root,detached:true,stdio:'ignore'});gateway.unref();await writeFile(path.join(runtime,'gateway.pid'),String(gateway.pid),{mode:0o600});}
 await healthy(config.apiUrl+'/health');
 await healthy(config.apiUrl+'/rest/v1/rpc/get_catalogue',{apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`});
 }
 console.log('Local-only GoTrue/PostgREST harness ready. Credentials are in ignored .local-stack.json (0600), never printed.');
 }finally{await client.end();}}
main().catch(error=>{console.error('Local harness failed:',String(error.message).replace(/postgres:\/\/[^\s]+/g,'[redacted database URL]'));process.exitCode=1;});
