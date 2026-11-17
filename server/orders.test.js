import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
const origin = 'http://localhost:5173', adminKey = 'test-secret-with-at-least-32-random-characters';
const post = (app, cookie, url, payload) => app.inject({ method: 'POST', url, headers: { origin, cookie }, payload });
const get = (app, cookie, url) => app.inject({ url, headers: { cookie } });
async function session(app) { return (await post(app, '', '/api/session', {})).headers['set-cookie'].split(';')[0]; }
async function login(app) { return (await post(app, '', '/api/admin/session', { key: adminKey })).headers['set-cookie'].split(';')[0]; }
async function order(app, cookie) { return (await post(app, cookie, '/api/checkout', { requestKey: 'test-key-1234567890', basket: { chicken: 1 }, address: { name: 'Demo', email: 'demo@example.com', line1: '123 Test', city: 'Test', state: 'Test', postalCode: '110001' } })).json(); }
test('customer history is isolated; admin authentication, transitions and tracking validation', async t => {
  const app = createApp({ dbPath: ':memory:', adminKey }); t.after(() => app.close());
  const customer = await session(app), outsider = await session(app), created = await order(app, customer);
  assert.equal((await get(app, customer, '/api/order-history')).json().length, 1);
  assert.equal((await get(app, outsider, '/api/order-history')).json().length, 0);
  assert.equal((await get(app, outsider, `/api/order-history/${created.id}`)).statusCode, 404);
  assert.equal((await get(app, customer, '/api/admin/orders')).statusCode, 401);
  assert.equal((await post(app, customer, '/api/admin/session', { key: 'wrong' })).statusCode, 401);
  const admin = await login(app), url = `/api/admin/orders/${created.id}`;
  assert.equal((await get(app, admin, '/api/admin/orders')).json().length, 1);
  assert.equal((await post(app, customer, url, { fulfillment: 'processing' })).statusCode, 401);
  assert.equal((await post(app, admin, url, { fulfillment: 'delivered' })).statusCode, 409);
  assert.equal((await post(app, admin, url, { fulfillment: 'processing' })).statusCode, 200);
  assert.equal((await post(app, admin, url, { fulfillment: 'shipped' })).statusCode, 400);
  assert.equal((await post(app, admin, url, { fulfillment: 'shipped', trackingNumber: 'TEST', trackingUrl: 'javascript:alert(1)' })).statusCode, 400);
  assert.equal((await post(app, admin, url, { fulfillment: 'shipped', trackingNumber: 'TEST', trackingUrl: 'https://example.com/track/TEST' })).statusCode, 200);
  assert.equal((await get(app, customer, `/api/order-history/${created.id}`)).json().tracking_number, 'TEST');
  assert.equal((await post(app, admin, url, { fulfillment: 'processing' })).statusCode, 409);
  await post(app, admin, '/api/admin/logout', {});
  assert.equal((await get(app, admin, '/api/admin/orders')).statusCode, 401);
});
test('orders and browser sessions survive restart; admin disabled without configuration', async t => {
 const dir=mkdtempSync(join(tmpdir(),'goodbowl-order-test-')),dbPath=join(dir,'orders.sqlite');
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let app=createApp({dbPath}); const customer=await session(app);const created=await order(app,customer);await app.close();
 app=createApp({dbPath});t.after(()=>app.close());
 assert.equal((await get(app,customer,`/api/order-history/${created.id}`)).json().status,'demo');
 assert.equal((await post(app,customer,'/api/admin/session',{key:adminKey})).statusCode,503);
});
test('administrator login rate limit and pending order mutation refusal', async t=>{
 const app=createApp({dbPath:':memory:',adminKey});t.after(()=>app.close());
 const customer=await session(app),created=await order(app,customer),admin=await login(app);
 app.db.prepare("UPDATE orders SET status='pending' WHERE id=?").run(created.id);
 assert.equal((await post(app,admin,`/api/admin/orders/${created.id}`,{fulfillment:'processing'})).statusCode,409);
 for(let i=0;i<4;i++) await post(app,'','/api/admin/session',{key:'wrong'});
 assert.equal((await post(app,'','/api/admin/session',{key:'wrong'})).statusCode,429);
});
