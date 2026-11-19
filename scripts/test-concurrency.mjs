/** Real Postgres transactions; requires a migrated disposable local database. No network mocks. */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const connectionString=process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const databaseUrl=new URL(connectionString);
if(!['postgres:','postgresql:'].includes(databaseUrl.protocol)||!['127.0.0.1','localhost'].includes(databaseUrl.hostname))throw new Error('Concurrency tests require a disposable loopback database.');
const pool = new pg.Pool({connectionString,max:24});
const owner=randomUUID(), buyer=randomUUID(), other=randomUUID();
const actors=[owner,buyer,other]; const properties=[];
async function as(actor,sql,args=[]){const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:'authenticated'})]);await c.query('SET LOCAL ROLE authenticated');const r=await c.query(sql,args);await c.query('COMMIT');return r.rows[0]?.j;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function property(){const p=await as(owner,"SELECT public.create_property('Concurrency apartment','Test fixture','Cotroceni','Private fixture address','apartment',70,3,2,2012,10000000,50000,'{}') j");properties.push(p.id);const r=await pool.query('SELECT * FROM app.listings WHERE property_id=$1 ORDER BY transaction_type',[p.id]);return {p,listings:r.rows};}
async function auction(listing,mode='ascending',offset='-1 second',duration='1 hour'){return as(owner,'SELECT public.start_auction($1,$2,\'public\',clock_timestamp()+$3::interval,clock_timestamp()+$4::interval,1000,100) j',[listing.id,mode,offset,duration]);}
async function bid(a,actor=buyer,amount=1000,key=randomUUID()){return as(actor,'SELECT public.place_bid($1,$2,$3) j',[a.id,amount,key]);}
async function cleanup(){for(const p of properties){const c=await pool.connect();try{await c.query('BEGIN');await c.query('DELETE FROM app.idempotency WHERE actor_id=ANY($1::uuid[])',[actors]);await c.query('DELETE FROM app.notification_outbox WHERE user_id=ANY($1::uuid[])',[actors]);await c.query('DELETE FROM app.reservations WHERE property_id=$1',[p]);await c.query('DELETE FROM app.bids WHERE auction_id IN (SELECT id FROM app.auctions WHERE property_id=$1)',[p]);await c.query('UPDATE app.listings SET auction_id=NULL WHERE property_id=$1',[p]);await c.query('DELETE FROM app.auction_members WHERE auction_id IN (SELECT id FROM app.auctions WHERE property_id=$1)',[p]);await c.query('DELETE FROM app.auctions WHERE property_id=$1',[p]);await c.query('DELETE FROM app.listings WHERE property_id=$1',[p]);await c.query('DELETE FROM app.properties WHERE id=$1',[p]);await c.query('COMMIT');}finally{c.release();}}await pool.query('DELETE FROM app.audit_events WHERE actor_id=ANY($1::uuid[])',[actors]);await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])',[actors]);}
try {
 assert.equal((await pool.query('SELECT count(*)::int n FROM app.notification_outbox WHERE delivered_at IS NULL')).rows[0].n,0,'disposable database must have no preexisting pending notifications');
 for(const [i,id] of actors.entries()) await pool.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,clock_timestamp())',[id,`concurrency-${id}-${i}@example.test`]);
 const first=await property();
 const starts=await Promise.allSettled(first.listings.map(l=>auction(l)));
 assert.equal(starts.filter(x=>x.status==='fulfilled').length,1,'two linked listings must serialize auction starts');
 console.log('PASS: concurrent sale/rent auction starts accept exactly one');
 const a=starts.find(x=>x.status==='fulfilled').value;
 const bids=await Promise.allSettled(Array.from({length:20},(_,i)=>bid(a,i%2?buyer:other)));
 assert.equal(bids.filter(x=>x.status==='fulfilled').length,1,'equal ascending bids accept once');
 console.log('PASS: twenty equal bids accept exactly one');
 const replayKey=randomUUID();
 const replays=await Promise.all(Array.from({length:12},()=>bid(a,buyer,1100,replayKey)));
 assert.equal(new Set(replays.map(x=>x.id)).size,1,'concurrent replay must create one bid');
 console.log('PASS: twelve simultaneous idempotent bids return one persisted bid');
 await pool.query("UPDATE app.auctions SET ends_at=clock_timestamp()-interval '1 second' WHERE id=$1",[a.id]);
 const reserve=await Promise.allSettled(Array.from({length:8},()=>as(owner,'SELECT public.request_reservation($1,100,$2) j',[replays[0].id,randomUUID()])));
 assert.equal(reserve.filter(x=>x.status==='fulfilled').length,1,'one reservation per property');
 assert.equal((await pool.query('SELECT count(*)::int n FROM app.reservations WHERE property_id=$1',[first.p.id])).rows[0].n,1);
 const r=reserve.find(x=>x.status==='fulfilled').value;
 await as(buyer,"SELECT public.advance_reservation($1,'fund',$2) j",[r.id,randomUUID()]);
 await pool.query("UPDATE app.reservations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[r.id]);
 await pool.query('SELECT public.close_expired_auctions()');
 const expired=(await pool.query('SELECT * FROM app.reservations WHERE id=$1',[r.id])).rows[0];
 assert.equal(expired.status,'expired'); assert.equal(expired.deposit_status,'refunded');
 console.log('PASS: reservation race accepts one; independent worker refunds expired simulation');
 const second=await property(); const late=await auction(second.listings[0]);
 const locker=await pool.connect();
 try{
  await locker.query('BEGIN');await locker.query('SELECT id FROM app.properties WHERE id=$1 FOR UPDATE',[second.p.id]);
  await locker.query("UPDATE app.auctions SET ends_at=clock_timestamp()+interval '300 milliseconds' WHERE id=$1",[late.id]);
  const pending=bid(late).then(()=>({accepted:true}),e=>({accepted:false,message:e.message}));
  await new Promise(r=>setTimeout(r,600));await locker.query('COMMIT');
  const result=await pending;assert.equal(result.accepted,false);assert.equal(result.message,'Auction is not accepting bids');
 } finally {locker.release();}
 console.log('PASS: bid waiting on property lock checks actual time after lock');
 const third=await property();const scheduled=await auction(third.listings[0],'sealed','1 hour','2 hours');
 await assert.rejects(()=>bid(scheduled),/Auction is not accepting bids/);
 console.log('PASS: scheduled auction rejects premature bid');
 assert.equal((await pool.query('SELECT count(*)::int n FROM app.notification_outbox WHERE delivered_at IS NULL AND NOT(user_id=ANY($1::uuid[]))',[actors])).rows[0].n,0,'refuse to claim unrelated pending notifications');
 await pool.query('DELETE FROM app.notification_outbox WHERE user_id=ANY($1::uuid[])',[actors]);
 const fixture=await pool.query("INSERT INTO app.notification_outbox(user_id,event) SELECT $1::uuid,'message.received' FROM generate_series(1,100) RETURNING id",[owner]);
 const expectedIds=new Set(fixture.rows.map(row=>String(row.id)));
 const workers=await Promise.all([pool.connect(),pool.connect()]);
 try{
  await Promise.all(workers.map(async worker=>{
   await worker.query('BEGIN');
   await worker.query('SET LOCAL ROLE service_role');
  }));
  // Both transactions retain their claimed row locks until both results arrive.
  const claims=await Promise.all(workers.map(worker=>worker.query('SELECT public.claim_notifications(1000) j')));
  const batches=claims.map(result=>result.rows[0].j);
  assert.deepEqual(batches.map(batch=>batch.length),[50,50],'service workers each obey the fifty-item limit');
  const claimedIds=batches.flat().map(item=>String(item.id));
  assert.equal(new Set(claimedIds).size,100,'concurrent workers claim distinct notifications with SKIP LOCKED');
  assert.deepEqual(new Set(claimedIds),expectedIds,'workers claim exactly the one hundred fixture notifications');
 }finally{
  await Promise.allSettled(workers.map(worker=>worker.query('ROLLBACK')));
  workers.forEach(worker=>worker.release());
 }
 console.log('PASS: concurrent service workers claim distinct fifty-item batches from exactly one hundred fixture notifications');
 const mfaUser=randomUUID(), mfaFactor=randomUUID();
 await pool.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,clock_timestamp())',[mfaUser,`mfa-concurrency-${mfaUser}@example.test`]);
 async function mfaVerifyAttempt(){
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('SET LOCAL ROLE service_role');
   const result=await client.query('SELECT public.mfa_verify_rate_limit($1::uuid,$2::uuid,$3::text,$4::text) AS j',[mfaUser,mfaFactor,'203.0.113.99','attempt']);
   await client.query('COMMIT');
   return result.rows[0].j;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 const mfaAttempts=await Promise.all(Array.from({length:10},()=>mfaVerifyAttempt()));
 assert.equal(mfaAttempts.filter((row)=>row.allowed===true).length,5,'ten parallel MFA verify reservations allow exactly five');
 assert.equal(mfaAttempts.filter((row)=>row.allowed===false).length,5,'ten parallel MFA verify reservations deny exactly five');
 const lockedAudit=await pool.query("SELECT count(*)::int n FROM app.audit_events WHERE actor_id=$1 AND event='mfa.verify_locked'",[mfaUser]);
 assert.equal(lockedAudit.rows[0].n,1,'exactly one verify_locked audit row after parallel MFA attempts');
 await pool.query('DELETE FROM app.audit_events WHERE actor_id=$1',[mfaUser]);
 await pool.query('DELETE FROM app.mfa_verify_factor_limits WHERE user_id=$1',[mfaUser]);
 await pool.query('DELETE FROM app.mfa_verify_ip_limits WHERE client_ip=$1::inet',['203.0.113.99']);
 await pool.query('DELETE FROM auth.users WHERE id=$1',[mfaUser]);
 console.log('PASS: ten parallel MFA verify limiter attempts yield five allowed and one verify_locked audit row');
 // Hold the shared property row until both real sessions are observed waiting.
 // This barrier proves overlap without relying on a lucky Promise scheduling race.
 for(let round=0;round<2;round++){
  const fixture=await property();
  const sale=fixture.listings.find(l=>l.transaction_type==='sale');
  const rent=fixture.listings.find(l=>l.transaction_type==='rent');
  const closed=await auction(sale);const selected=await bid(closed);
  await pool.query("UPDATE app.auctions SET ends_at=clock_timestamp()-interval '1 second' WHERE id=$1",[closed.id]);
  const locker=await pool.connect();const marker=`lr55-${randomUUID()}`;
  let racers,locked=false;
  try{
   await locker.query('BEGIN');locked=true;
   await locker.query('SELECT id FROM app.properties WHERE id=$1 FOR UPDATE',[fixture.p.id]);
   const reserveSql=`SELECT public.request_reservation($1,100,$2) j /* ${marker} */`;
   const startSql=`SELECT public.start_auction($1,'ascending','public',clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 hour',1000,100) j /* ${marker} */`;
   racers=Promise.allSettled([as(owner,reserveSql,[selected.id,randomUUID()]),as(owner,startSql,[rent.id])]);
   const deadline=Date.now()+10000;let waiting=0;
   while(waiting<2&&Date.now()<deadline){
    waiting=(await pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND position($1 in query)>0",[marker])).rows[0].n;
    if(waiting<2)await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert.equal(waiting,2,'both reservation and auction sessions must wait on the property barrier');
   await locker.query('COMMIT');locked=false;
   const results=await racers;
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'reservation versus linked auction accepts exactly one');
   const loser=results.find(r=>r.status==='rejected');assert.equal(loser.reason.code,'P0001');
   assert.equal(loser.reason.message,results[0].status==='fulfilled'?'Property is reserved':'Property already has an active auction');
   const active=(await pool.query("SELECT ((SELECT count(*) FROM app.auctions WHERE property_id=$1 AND status IN ('scheduled','active'))+(SELECT count(*) FROM app.reservations WHERE property_id=$1 AND status IN ('requested','funded')))::int n",[fixture.p.id])).rows[0].n;
   assert.equal(active,1,'linked property cannot have both an active reservation and auction');
  }finally{
   if(locked)await locker.query('ROLLBACK');
   if(racers)await racers;
   locker.release();
  }
 }
 console.log('PASS: barrier-coordinated reservation versus linked auction races accept exactly one with the shared conflict');
 console.log('All nine concurrency/deadline scenarios passed.');
} finally {await cleanup();await pool.end();}
