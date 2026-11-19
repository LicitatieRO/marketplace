import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function auditFindings(audit,baseline,now=new Date()) {
 return Object.entries(audit.vulnerabilities??{}).filter(([,v])=>['high','critical'].includes(v.severity)).flatMap(([name,v])=>{
 const advisories=v.via.filter(x=>typeof x==='object');
 if(!advisories.length)return [`${name}: ${v.severity} transitive exposure requires review`];
 return advisories.filter(a=>!baseline.some(b=>b.package===name&&b.advisory===a.url?.split('/').at(-1)&&b.reason&&new Date(b.expires)>now)).map(a=>`${name}: ${v.severity} ${a.url??a.source}`);
 });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=spawnSync('npm',['audit','--json'],{encoding:'utf8'});
 let report;try{report=JSON.parse(result.stdout);}catch{throw new Error('npm audit returned no valid report; cannot declare dependencies safe');}
 if(report.error||(!report.vulnerabilities&&!report.metadata))throw new Error('Dependency audit could not complete');
 const baseline=JSON.parse(readFileSync(new URL('../docs/dependency-audit-baseline.json',import.meta.url),'utf8'));
 const findings=auditFindings(report,baseline);
 if(findings.length){console.error(findings.join('\n'));process.exitCode=1;}else console.log('No unreviewed high/critical dependency advisories. Low/moderate findings remain visible via npm audit.');
}
