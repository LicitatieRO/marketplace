import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  calls: [] as { name: string; params: Record<string, unknown> }[],
  previewOk: true, previewError: false, finishOk: true,
}));
vi.mock('@/lib/config', () => ({supabaseConfig: () => ({url:'http://127.0.0.1:54321',key:'public-test'}),isConfigured:()=>true}));
vi.mock('@supabase/supabase-js', () => ({createClient: () => ({
  rpc: async (name: string, params: Record<string, unknown> = {}) => {
    state.calls.push({name,params});
    if(name==='close_expired_auctions')return {data:null,error:null};
    if(name==='claim_notifications')return {data:[{id:'42',email:'recipient@example.test',event:'bid.placed',entity_id:'private-entity',lease_token:'10000000-0000-4000-8000-000000000001'}],error:null};
    if(name==='store_notification_preview')return {data:state.previewOk,error:state.previewError?{message:'private database detail'}:null};
    if(name==='finish_notification')return {data:state.finishOk,error:null};
    throw Error('Unexpected RPC');
  },
})}));
import { GET } from '@/app/api/cron/notifications/route';
const originalEnv={...process.env};
const transport=vi.fn();
beforeEach(()=>{
  state.calls=[];state.previewOk=true;state.previewError=false;state.finishOk=true;
  process.env.CRON_SECRET='synthetic-cron-secret';process.env.SUPABASE_SECRET_KEY='synthetic-worker-key';
  process.env.VERCEL_ENV='production';process.env.APP_URL='https://licitatiero-staging.vercel.app';
  process.env.EMAIL_DELIVERY_MODE='staging_outbox';
  delete process.env.RESEND_API_KEY;delete process.env.EMAIL_FROM;
  vi.stubEnv('NODE_ENV','production');
  transport.mockReset().mockRejectedValue(new Error('No live transport permitted'));
  vi.stubGlobal('fetch',transport);
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();process.env={...originalEnv};});
function invoke(host='licitatiero-staging.vercel.app',secret='synthetic-cron-secret'){
  return GET(new Request(`https://${host}/api/cron/notifications`,{headers:{host,authorization:`Bearer ${secret}`}}));
}
describe('nonempty staging notification worker',()=>{
  it('stores a bilingual simulation preview before acknowledging, without contacting Resend',async()=>{
    const response=await invoke();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({status:'ok',delivery_mode:'staging_outbox',sent:1,retry:0,stale:0});
    expect(state.calls.map(c=>c.name)).toEqual(['close_expired_auctions','claim_notifications','store_notification_preview','finish_notification']);
    expect(state.calls[1].params).toEqual({p_limit:5});
    expect(state.calls[2].params).toMatchObject({p_id:42,p_lease_token:'10000000-0000-4000-8000-000000000001',p_subject:expect.stringContaining('ofertă nouă / new offer'),p_body:expect.stringContaining('simulări; nu se transferă bani.')});
    expect(state.calls[2].params.p_body).toContain('simulations; no money moves.');
    expect(JSON.stringify(state.calls)).not.toContain('recipient@example.test');
    expect(JSON.stringify(state.calls)).not.toContain('private-entity');
    expect(state.calls[3].params).toEqual({p_id:'42',p_lease_token:'10000000-0000-4000-8000-000000000001',p_delivered:true});
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['error','stale-store'] as const)('keeps a failed preview retryable: %s',async mode=>{
    state.previewError=mode==='error';state.previewOk=false;
    const response=await invoke();
    expect(await response.json()).toMatchObject({sent:0,retry:1,stale:0});
    expect(state.calls.at(-1)).toMatchObject({name:'finish_notification',params:{p_delivered:false}});
    expect(transport).not.toHaveBeenCalled();
  });
  it('does not report stale finalization as sent',async()=>{
    state.finishOk=false;
    const response=await invoke();
    expect(await response.json()).toMatchObject({sent:0,retry:0,stale:1});
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects a mismatched production host before claiming or acknowledging rows',async()=>{
    process.env.APP_URL='https://licitatiero.ro';
    const response=await invoke('licitatiero.ro');
    expect(response.status).toBe(503);
    expect(state.calls).toEqual([]);
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated cron calls before claiming rows',async()=>{
    const response=await invoke(undefined,'incorrect');
    expect(response.status).toBe(401);
    expect(state.calls).toEqual([]);
    expect(transport).not.toHaveBeenCalled();
  });
});
