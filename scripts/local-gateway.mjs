/** Loopback-only LOCAL test gateway. Not a production Supabase/Kong replacement. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
const settings=JSON.parse(await readFile(new URL('../.local-stack.json',import.meta.url),'utf8'));
const equal=(a,b)=>{if(typeof a!=='string')return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);};
const server=http.createServer((request,response)=>{
 if(request.url==='/health'){response.writeHead(200,{'content-type':'application/json'});response.end('{"local":true,"gateway":"ready"}');return;}
 const key=request.headers.apikey;
 if(!equal(key,settings.anonKey)&&!equal(key,settings.serviceRoleKey)){response.writeHead(401,{'content-type':'application/json'});response.end('{"message":"Invalid local API key"}');return;}
 let port,prefix;
 if(request.url==='/auth/v1'||request.url.startsWith('/auth/v1/')){port=54323;prefix='/auth/v1';}
 else if(request.url==='/rest/v1'||request.url.startsWith('/rest/v1/')){port=54324;prefix='/rest/v1';}
 else {response.writeHead(404);response.end('Local harness supports Auth and REST only.');return;}
 const headers={...request.headers,host:`127.0.0.1:${port}`};delete headers.apikey;
 headers['x-forwarded-host']='127.0.0.1:54321';headers['x-forwarded-proto']='http';headers['x-forwarded-prefix']=prefix;
 const upstream=http.request({hostname:'127.0.0.1',port,path:request.url.slice(prefix.length)||'/',method:request.method,headers},result=>{response.writeHead(result.statusCode??502,result.headers);result.pipe(response);});
 upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end('Local backend unavailable.');});
 request.on('aborted',()=>upstream.destroy());request.pipe(upstream);
});
server.listen(54321,'127.0.0.1',()=>console.log('Local Auth/REST gateway listening on loopback port 54321.'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
