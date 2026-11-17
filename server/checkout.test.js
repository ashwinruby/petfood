import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
const origin = 'http://localhost:5173';
const address = { name: 'Demo', email: 'demo@example.com', line1: '123 Test Street', city: 'Test', state: 'Test', postalCode: '110001' };
async function session(app) { const r = await app.inject({ method: 'POST', url: '/api/session', headers: { origin }, payload: {} }); return r.headers['set-cookie'].split(';')[0]; }
function post(app, cookie, url, payload) { return app.inject({ method: 'POST', url, headers: { origin, cookie }, payload }); }
const checkout = (basket = { chicken: 1 }, requestKey = '1234567890123456') => ({ basket, requestKey, address });
test('authoritative totals, persistence, idempotency, stock and ownership', async t => {
  const app = createApp({ dbPath: ':memory:' }); t.after(() => app.close());
  const cookie = await session(app);
  const quote = await post(app, cookie, '/api/checkout/quote', { basket: { chicken: 1 }, total: 1 });
  assert.equal(quote.json().total, 99800);
  assert.equal((await post(app, cookie, '/api/checkout/quote', { basket: { chicken: 2 } })).json().shipping, 0);
  const order = (await post(app, cookie, '/api/checkout', { ...checkout(), total: 1 })).json();
  assert.equal(order.status, 'demo');
  assert.equal((await post(app, cookie, '/api/checkout', checkout())).json().id, order.id);
  assert.equal((await post(app, cookie, '/api/checkout', checkout({ chicken: 2 }))).statusCode, 409);
  const stored = await app.inject({ url: `/api/orders/${order.id}`, headers: { cookie } });
  assert.equal(stored.json().total, 99800);
  assert.equal((await app.inject({ url: `/api/orders/${order.id}`, headers: { cookie: await session(app) } })).statusCode, 404);
  assert.equal((await post(app, cookie, '/api/checkout', checkout({ chicken: 20 }, 'another1234567890'))).statusCode, 409);
});
test('rejects malformed input, missing auth, wrong origins, oversized bodies and live mode', async t => {
  const app = createApp({ dbPath: ':memory:' }); t.after(() => app.close()); const cookie = await session(app);
  for (const basket of [{ chicken: -1 }, { chicken: 1.2 }, { missing: 1 }, {}, []]) assert.equal((await post(app, cookie, '/api/checkout', checkout(basket))).statusCode, 400);
  assert.equal((await post(app, cookie, '/api/checkout', { ...checkout(), address: { ...address, postalCode: 'x' } })).statusCode, 400);
  assert.equal((await post(app, '', '/api/checkout/quote', { basket: { chicken: 1 } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/session', payload: {} })).statusCode, 403);
  assert.equal((await post(app, cookie, '/api/checkout', { huge: 'x'.repeat(17000) })).statusCode, 413);
  assert.throws(() => createApp({ mode: 'live' }));
  assert.throws(() => createApp({ mode: 'stripe-test', stripeKey: 'sk_live_wrong', webhookSecret: 'secret' }));
});
test('signed test payment events are validated and idempotent; redirects cannot mark paid', async t => {
  let event;
  const stripe = { checkout: { sessions: { create: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/test' }) } }, webhooks: { constructEvent: (raw, signature) => { if (signature !== 'verified') throw new Error(); assert.ok(Buffer.isBuffer(raw)); return event; } } };
  const app = createApp({ dbPath: ':memory:', mode: 'stripe-test', stripeKey: 'sk_test_dummy', webhookSecret: 'whsec_dummy', stripe, products: [{ id: 'chicken', name: 'Verified test fixture', verified: true, variants: [{ id: 'chicken', weight: '1 kg', price: 899, stock: 20 }] }] }); t.after(() => app.close());
  const cookie = await session(app); const order = (await post(app, cookie, '/api/checkout', checkout())).json();
  const webhook = signature => app.inject({ method: 'POST', url: '/api/payments/webhook', headers: { 'stripe-signature': signature }, payload: {} });
  assert.equal((await webhook('forged')).statusCode, 400);
  event = { id: 'evt_1', livemode: false, type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', metadata: { orderId: order.id }, amount_total: 1, currency: 'inr', payment_status: 'paid' } } };
  assert.equal((await webhook('verified')).statusCode, 400);
  event.data.object.amount_total = 99800;
  assert.equal((await webhook('verified')).statusCode, 200);
  assert.equal((await webhook('verified')).statusCode, 200);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM payment_events').get().n, 1);
  assert.equal((await app.inject({ url: `/api/orders/${order.id}`, headers: { cookie } })).json().status, 'paid');
  event.id = 'evt_2'; event.type = 'checkout.session.expired';
  assert.equal((await webhook('verified')).statusCode, 200);
  assert.equal((await app.inject({ url: `/api/orders/${order.id}`, headers: { cookie } })).json().status, 'paid');
});
test('unverified catalogue cannot enter Stripe sandbox', async t => {
 const app=createApp({dbPath:':memory:',mode:'stripe-test',stripeKey:'sk_test_dummy',webhookSecret:'secret',stripe:{},products:[{name:'Sample',verified:false,variants:[{id:'chicken',price:899,stock:20}]}]});t.after(()=>app.close());
 assert.equal((await post(app,await session(app),'/api/checkout',checkout())).statusCode,409);
});
