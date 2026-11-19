import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const patterns = [
 ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
 ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['cloud access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
 ['Stripe secret', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g],
 ['Resend secret', /\bre_[A-Za-z0-9]{24,}\b/g],
 ['Supabase secret', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g],
 ['database password URL', /postgres(?:ql)?:\/\/[^\s:/]+:(?!\$|<|replace|example|YOUR)[^\s@]{5,}@[^\s"']+/gi],
 ['assigned secret', /(?:SUPABASE_SERVICE_ROLE_KEY|VERCEL_TOKEN|RESEND_API_KEY|SUPABASE_ACCESS_TOKEN)\s*[=:]\s*["']?(?!\$|<|replace|example|YOUR)[A-Za-z0-9_.-]{24,}/g],
 ['JWT secret', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\b/g],
];
export function detectSecrets(text) {return patterns.flatMap(([name,regex])=>[...text.matchAll(regex)].filter(m=>{
 if(name!=='database password URL')return true;
 try{const url=new URL(m[0]);return !(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.username==='postgres'&&url.password==='postgres');}catch{return true;}
 }).map(m=>({name,line:text.slice(0,m.index).split('\n').length})));}
export function scanTracked() {
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const findings=[];
 for(const file of files){const data=readFileSync(file); if(data.includes(0))continue; for(const finding of detectSecrets(data.toString()))findings.push({file,...finding});}
 for(const f of findings)console.error(`${f.file}:${f.line}: possible ${f.name} (value withheld)`);
 if(findings.length)throw new Error(`${findings.length} possible secrets in tracked files`);
 console.log(`Secret patterns scanned in ${files.length} tracked files; values never printed.`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)scanTracked();
