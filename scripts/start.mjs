import { access,cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
try{await access('.next/standalone/server.js');}catch{console.error('Run npm run build before npm start.');process.exit(1);}
await cp('public','.next/standalone/public',{recursive:true,force:true});
await cp('data','.next/standalone/data',{recursive:true,force:true});
await cp('.next/static','.next/standalone/.next/static',{recursive:true,force:true});
const child=spawn(process.execPath,['--env-file-if-exists=.env.local','.next/standalone/server.js'],{stdio:'inherit',env:{...process.env,HOSTNAME:process.env.APP_LISTEN_HOST||'0.0.0.0'}});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>{if(signal)process.kill(process.pid,signal);else process.exitCode=code||0;});
