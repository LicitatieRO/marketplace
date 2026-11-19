import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base=process.env.INTEGRATION_BASE_URL||'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Integration writes are restricted to a local test application.');
async function call(path,{cookie,body,origin=base}={}){
 const headers={};if(cookie)headers.Cookie=cookie;
 if(body){headers['Content-Type']='application/json';if(origin)headers.Origin=origin;}
 const response=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
 return {status:response.status,headers:response.headers,json:await response.json()};
}
async function login(email){const r=await call('/api/auth',{body:{action:'login',email,password:process.env.E2E_PASSWORD}});assert.equal(r.status,200);const cookies=r.headers.getSetCookie();assert.ok(cookies.some(c=>/HttpOnly/i.test(c)),'session must be HttpOnly');assert.ok(cookies.every(c=>/SameSite=lax/i.test(c)),'session must use SameSite');return cookies.map(c=>c.split(';')[0]).join('; ');}
async function mutate(cookie,action,payload){return call('/api/marketplace',{cookie,body:{action,payload}});}
test('HTTP identity, CSRF, private offers and idempotency hold against real Auth/PostgREST',async t=>{
 assert.ok(process.env.E2E_PASSWORD,'Configure local test accounts first');
 await t.test('anonymous workspace and missing/foreign Origin requests fail closed',async()=>{
  assert.equal((await call('/api/workspace')).status,401);
  assert.equal((await call('/api/auth',{body:{action:'logout'},origin:null})).status,403);
  assert.equal((await call('/api/auth',{body:{action:'logout'},origin:'https://attacker.example'})).status,403);
  assert.equal((await call('/api/cron/notifications')).status,401);
 });
 const owner=await login('owner@licitatiero.local');const buyer=await login('buyer@licitatiero.local');const other=await login('other@licitatiero.local');
 const address=`Private HTTP test address ${randomUUID()}`;
 const created=await mutate(owner,'create_property',{p_title:'HTTP privacy fixture',p_description:'A local integration property, never a real property advertisement.',p_neighborhood:'Cotroceni',p_exact_address:address,p_property_type:'apartment',p_area_sqm:60,p_rooms:2,p_floor:1,p_built_year:2015,p_sale_price_minor:10000000,p_rent_price_minor:75000,p_image_urls:[]});
 assert.equal(created.status,200);const propertyId=created.json.data.id;
 const listings=(await call('/api/catalogue')).json.data.filter(l=>l.property_id===propertyId);
 assert.equal(listings.length,2);assert.ok(!JSON.stringify(listings).includes(address),'public catalogue must not leak private address');
 const sale=listings.find(l=>l.transaction_type==='sale');const rent=listings.find(l=>l.transaction_type==='rent');
 const tour=await mutate(owner,'set_property_tour',{p_property_id:propertyId,p_tour_url:'https://www.kuula.co/share/collection/demo123'});assert.equal(tour.status,200);
 assert.equal((await call(`/api/listings/${sale.id}`)).json.data.tour_url,'https://kuula.co/share/collection/demo123');
 const auction=await mutate(owner,'start_auction',{p_listing_id:sale.id,p_mode:'sealed',p_access:'invite',p_starts_at:new Date(Date.now()-1000).toISOString(),p_ends_at:new Date(Date.now()+600000).toISOString(),p_starting_price_minor:10000,p_min_increment_minor:100});
 assert.equal(auction.status,200);const auctionId=auction.json.data.id;
 await t.test('a linked listing cannot start a second auction',async()=>{
  const result=await mutate(owner,'start_auction',{p_listing_id:rent.id,p_mode:'ascending',p_access:'public',p_starts_at:new Date(Date.now()-1000).toISOString(),p_ends_at:new Date(Date.now()+600000).toISOString(),p_starting_price_minor:10000,p_min_increment_minor:100});assert.equal(result.status,409);
 });
 const key=randomUUID();
 await t.test('uninvited users cannot place a private offer',async()=>{assert.equal((await mutate(buyer,'place_bid',{p_auction_id:auctionId,p_amount_minor:1234500,p_idempotency_key:key})).status,409);});
 assert.equal((await mutate(owner,'invite_bidder',{p_auction_id:auctionId,p_email:'buyer@licitatiero.local'})).status,200);
 const bid=await mutate(buyer,'place_bid',{p_auction_id:auctionId,p_amount_minor:1234500,p_idempotency_key:key});assert.equal(bid.status,200);
 await t.test('retries return the original receipt and cannot change its amount',async()=>{
  const replay=await mutate(buyer,'place_bid',{p_auction_id:auctionId,p_amount_minor:1234500,p_idempotency_key:key});assert.equal(replay.json.data.id,bid.json.data.id);
  assert.equal((await mutate(buyer,'place_bid',{p_auction_id:auctionId,p_amount_minor:9999999,p_idempotency_key:key})).status,409);
 });
 await t.test('public and unrelated private views never expose confidential amounts',async()=>{
  const publicDetail=(await call(`/api/listings/${sale.id}`)).json.data;assert.equal(publicDetail.current_bid_minor,null);
  const workspace=(await call('/api/workspace',{cookie:other})).json.data;assert.ok(!workspace.bids.some(b=>b.id===bid.json.data.id));
  const bidder=(await call('/api/workspace',{cookie:buyer})).json.data;assert.ok(bidder.bids.some(b=>b.id===bid.json.data.id));
 });
 await t.test('caller-supplied identity fields are rejected',async()=>{assert.equal((await mutate(buyer,'place_bid',{p_auction_id:auctionId,p_amount_minor:1234500,p_idempotency_key:randomUUID(),p_user_id:'11111111-1111-4111-8111-111111111111'})).status,400);});
});
