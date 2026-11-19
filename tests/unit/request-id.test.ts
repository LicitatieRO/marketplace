import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ configured: false, databaseOk: true, throws: false, refresh: false }));
vi.mock('@/lib/config', () => ({ isConfigured: () => state.configured, supabaseConfig: () => ({url:'https://example.supabase.co',key:'test'}) }));
vi.mock('@/lib/server/supabase', () => ({getSupabase: async () => {if(state.throws)throw Error('private');return {rpc:async()=>({error:state.databaseOk?null:{message:'private'}})};}}));
vi.mock('@supabase/ssr', () => ({createServerClient: (_url: string, _key: string, options: {cookies:{setAll:(values:{name:string;value:string;options:object}[])=>void}}) => ({auth:{getUser:async()=>{if(state.refresh)options.cookies.setAll([{name:'sb-test',value:'rotated',options:{}}]);}}})}));
import { requestIdFor } from '@/lib/server/request-id';
import { GET } from '@/app/api/health/route';
import { proxy } from '@/proxy';
const id='10000000-0000-4000-8000-000000000001';
afterEach(()=>{state.configured=false;state.databaseOk=true;state.throws=false;state.refresh=false;vi.restoreAllMocks();});
describe('request IDs and health',()=>{
 it('accepts UUIDs and replaces arbitrary identifiers',()=>{
  expect(requestIdFor(id)).toBe(id);
  for(const input of [null,'alice@example.test','x'.repeat(10000),'bad\nvalue',id+'\n']){const result=requestIdFor(input);expect(result).not.toBe(input);expect(result).toHaveLength(36);expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);}
 });
 it.each([{configured:false,ok:false,throws:false,status:'unconfigured',code:503},{configured:true,ok:true,throws:false,status:'ok',code:200},{configured:true,ok:false,throws:false,status:'unavailable',code:503},{configured:true,ok:false,throws:true,status:'unavailable',code:503}])('keeps health compatibility and safe structured logs: $status',async c=>{
  state.configured=c.configured;state.databaseOk=c.ok;state.throws=c.throws;
  const log=vi.spyOn(console,'info').mockImplementation(()=>{});
  const response=await GET(new Request('http://localhost/api/health',{headers:{'x-request-id':id,'authorization':'private-secret'}}));
  expect(response.status).toBe(c.code);
  expect(response.headers.get('x-request-id')).toBe(id);
  expect(await response.json()).toMatchObject({status:c.status,database:c.configured&&c.ok,liveDeposits:false,requestId:id,ready:c.code===200});
  expect(log).toHaveBeenCalledOnce();
  expect(log.mock.calls[0][0]).toEqual({level:'info',route:'/api/health',status:c.code,durationMs:expect.any(Number),requestId:id});
  expect(JSON.stringify(log.mock.calls)).not.toContain('private');
 });
 it.each([false,true])('propagates IDs through proxy with cookie refresh=%s',async refresh=>{
  state.configured=refresh;state.refresh=refresh;
  const response=await proxy(new NextRequest('http://localhost/',{headers:{'x-request-id':id,cookie:'sb-test=old'}}));
  expect(response.headers.get('x-request-id')).toBe(id);
  expect(response.headers.get('x-middleware-request-x-request-id')).toBe(id);
  if(refresh)expect(response.cookies.get('sb-test')?.value).toBe('rotated');
 });
});
