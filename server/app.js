import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { registerOrders } from './orders.js';
import Stripe from 'stripe';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
const demoProducts = [
  { id: 'chicken', name: 'The Everyday Favorite', verified: false, variants: [{ id: 'chicken', weight: '1 kg', price: 899, stock: 20 }] },
  { id: 'salmon', name: 'The Happy & Healthy', verified: false, variants: [{ id: 'salmon', weight: '1 kg', price: 1099, stock: 20 }] },
  { id: 'tuna', name: 'The Purrfect Bowl', verified: false, variants: [{ id: 'tuna', weight: '500 g', price: 799, stock: 20 }] },
];
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export function createApp(options = {}) {
  const mode = options.mode ?? process.env.PAYMENT_MODE ?? 'demo';
  if (!['demo', 'stripe-test'].includes(mode)) throw new Error('Only demo and stripe-test modes are supported. Live sales are disabled.');
  const secret = options.stripeKey ?? process.env.STRIPE_SECRET_KEY;
  const webhookSecret = options.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (mode === 'stripe-test' && (!secret?.startsWith('sk_test_') || !webhookSecret)) throw new Error('Stripe test key and webhook secret required; live keys are not accepted.');
  const stripe = options.stripe ?? (mode === 'stripe-test' ? new Stripe(secret) : null);
  const origin = options.origin ?? process.env.APP_ORIGIN ?? 'http://localhost:5173';
  if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error('APP_ORIGIN must be an HTTP(S) origin without a trailing slash.');
  const dbPath = options.dbPath ?? process.env.DATABASE_PATH ?? resolve('data/goodbowl.sqlite');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
      created INTEGER NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL,
      items TEXT NOT NULL, subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL,
      address TEXT NOT NULL, payment_id TEXT, checkout_url TEXT,
      UNIQUE(owner, request_key));
    CREATE TABLE IF NOT EXISTS payment_events (id TEXT PRIMARY KEY);
  `);
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' });
  app.decorate('db', db);
  app.decorate('paymentMode', mode);
  app.addHook('onClose', async () => db.close());
  app.setErrorHandler((error, request, reply) => reply.code(error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500).send({ error: error.statusCode < 500 ? error.message : 'The request could not be completed. Please try again.' }));
  // Cookie-only browser authentication, no CORS; require exact origin for mutations.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (request.method === 'POST' && request.url !== '/api/payments/webhook' && request.headers.origin !== origin) throw fail('Request origin is not allowed.', 403);
  });
  function owner(request) {
    const token = request.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('goodbowl_session='))?.slice(17);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw fail('Start a checkout session first.', 401);
    const digest = hash(token);
    if (!db.prepare('SELECT hash FROM sessions WHERE hash=? AND created>?').get(digest, Date.now() - 30 * 86400000)) throw fail('Session expired. Start a new checkout session.', 401);
    return digest;
  }
  app.decorate('sessionOwner', owner);
  function catalogue() {
    if (options.products) return options.products;
    try { return JSON.parse(readFileSync(resolve('public/catalogue.json'), 'utf8')).products; }
    catch (error) {
      if (mode !== 'demo' || error.code !== 'ENOENT') throw fail('Catalogue unavailable.', 503);
      return demoProducts;
    }
  }
  function quote(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length < 1 || Object.keys(input).length > 30) throw fail('Choose between 1 and 30 products.');
    const products = catalogue();
    if (!Array.isArray(products)) throw fail('Catalogue unavailable.', 503);
    const items = Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([id, quantity]) => {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw fail('Quantities must be between 1 and 99.');
      const product = products.find(p => p.variants?.some(v => v.id === id));
      const variant = product?.variants.find(v => v.id === id);
      if (!variant || !Number.isFinite(variant.price) || variant.price <= 0 || !Number.isInteger(variant.stock) || variant.stock < 0) throw fail('A product is unavailable.');
      if (mode !== 'demo' && product.verified !== true) throw fail('Products must be verified before payment testing.', 409);
      const reserved = db.prepare("SELECT items FROM orders WHERE status IN ('pending', 'paid', 'demo')").all().reduce((sum, order) => sum + JSON.parse(order.items).filter(i => i.id === id).reduce((n, i) => n + i.quantity, 0), 0);
      if (quantity > variant.stock - reserved) throw fail(`${product.name} does not have enough stock.`, 409);
      const price = Math.round(variant.price * 100);
      if (!Number.isSafeInteger(price) || price > 100000000) throw fail('Invalid product price.', 503);
      return { id, name: product.name, weight: variant.weight, price, quantity };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal >= 150000 ? 0 : 9900;
    return { items, subtotal, shipping, total: subtotal + shipping, currency: 'INR', mode };
  }
  function address(input) {
    if (!input || typeof input !== 'object') throw fail('Delivery details are required.');
    const result = {};
    for (const [key, max] of Object.entries({ name: 100, email: 254, line1: 200, city: 100, state: 100, postalCode: 6 })) {
      if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max || /[\x00-\x1f]/.test(input[key])) throw fail(`Invalid ${key}.`);
      result[key] = input[key].trim();
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) || !/^\d{6}$/.test(result.postalCode)) throw fail('Enter a valid email and six-digit Indian PIN code.');
    result.country = 'IN';
    return result;
  }
  app.get('/api/config', async () => ({ mode, liveSalesEnabled: false, shipping: { fee: 9900, freeFrom: 150000, currency: 'INR', sample: true } }));
  app.post('/api/session', async (request, reply) => {
    try { owner(request); return { ok: true }; } catch {}
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES (?, ?)').run(hash(token), Date.now());
    reply.header('Set-Cookie', `goodbowl_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=2592000${origin.startsWith('https:') ? '; Secure' : ''}`);
    return { ok: true };
  });
  app.post('/api/checkout/quote', async request => { owner(request); return quote(request.body?.basket); });
  async function createPayment(id, pricing, delivery, reply) {
    try {
      const session = await stripe.checkout.sessions.create({ mode: 'payment', client_reference_id: id, customer_email: delivery.email,
        line_items: [...pricing.items.map(item => ({ quantity: item.quantity, price_data: { currency: 'inr', unit_amount: item.price, product_data: { name: `${item.name} (${item.weight})` } } })), ...(pricing.shipping ? [{ quantity: 1, price_data: { currency: 'inr', unit_amount: pricing.shipping, product_data: { name: 'Sample delivery charge' } } }] : [])],
        success_url: `${origin}/?checkout=success&order=${id}`, cancel_url: `${origin}/?checkout=cancelled&order=${id}`,
        metadata: { orderId: id },
      }, { idempotencyKey: `goodbowl-${id}` });
      db.prepare('UPDATE orders SET payment_id=?,checkout_url=? WHERE id=?').run(session.id, session.url, id);
      return reply.code(201).send({ id, status: 'pending', mode, checkoutUrl: session.url });
    } catch {
      // A network timeout may mean Stripe created the session. Keep its reservation pending;
      // retrying the same request key safely resumes that session; never falsely release stock.
      throw fail('Payment provider unavailable. Your order remains pending; do not retry with a new request key.', 503);
    }
  }
  app.post('/api/checkout', async (request, reply) => {
    const customer = owner(request);
    const { basket, requestKey } = request.body ?? {};
    if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey)) throw fail('A valid checkout request key is required.');
    const delivery = address(request.body.address);
    const fingerprint = hash(JSON.stringify({ basket: Object.entries(basket ?? {}).sort(), delivery }));
    const existing = db.prepare('SELECT * FROM orders WHERE owner=? AND request_key=?').get(customer, requestKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw fail('This request key belongs to a different checkout.', 409);
      if (existing.status === 'failed') throw fail('Previous payment attempt failed. Start a new checkout.', 409);
      if (mode === 'stripe-test' && existing.status === 'pending' && !existing.checkout_url) {
        return createPayment(existing.id, { ...existing, items: JSON.parse(existing.items) }, JSON.parse(existing.address), reply);
      }
      return { id: existing.id, status: existing.status, mode: existing.mode, checkoutUrl: existing.checkout_url };
    }
    const id = randomUUID();
    let pricing;
    db.exec('BEGIN IMMEDIATE');
    try {
      pricing = quote(basket);
      db.prepare('INSERT INTO orders (id,owner,request_key,fingerprint,created,mode,status,items,subtotal,shipping,total,address) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, customer, requestKey, fingerprint, Date.now(), mode, mode === 'demo' ? 'demo' : 'pending', JSON.stringify(pricing.items), pricing.subtotal, pricing.shipping, pricing.total, JSON.stringify(delivery));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    if (mode === 'demo') return reply.code(201).send({ id, status: 'demo', mode, checkoutUrl: null });
    return createPayment(id, pricing, delivery, reply);
  });
  app.get('/api/orders/:id', async request => {
    const order = db.prepare('SELECT id,status,mode,items,subtotal,shipping,total,created FROM orders WHERE id=? AND owner=?').get(request.params.id, owner(request));
    if (!order) throw fail('Order not found.', 404);
    return { ...order, items: JSON.parse(order.items) };
  });
  // Raw-body verification must happen before JSON parsing changes signed bytes.
  app.register(async webhook => {
    webhook.removeContentTypeParser('application/json');
    webhook.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => done(null, body));
    webhook.post('/api/payments/webhook', async request => {
      if (mode !== 'stripe-test') throw fail('Payments are disabled.', 404);
      let event;
      try { event = stripe.webhooks.constructEvent(request.body, request.headers['stripe-signature'], webhookSecret); }
      catch { throw fail('Invalid payment signature.', 400); }
      if (event.livemode) throw fail('Live payment events are not accepted.', 400);
      const session = event.data.object;
      const order = db.prepare('SELECT * FROM orders WHERE id=?').get(session.metadata?.orderId ?? '');
      if (!order) return { received: true };
      if (order.payment_id && order.payment_id !== session.id) throw fail('Payment session mismatch.', 400);
      if (session.amount_total !== order.total || session.currency !== 'inr') throw fail('Payment amount mismatch.', 400);
      let status;
      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) && session.payment_status === 'paid') status = 'paid';
      if (['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)) status = 'failed';
      if (!status) return { received: true };
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!db.prepare('SELECT id FROM payment_events WHERE id=?').get(event.id)) {
          db.prepare('INSERT INTO payment_events VALUES (?)').run(event.id);
          // A delayed failure must never downgrade a confirmed payment.
          db.prepare("UPDATE orders SET status=?,payment_id=? WHERE id=? AND status='pending'").run(status, session.id, order.id);
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return { received: true };
    });
  });
  app.register(async scope => registerOrders(scope, { ...options, origin }));
  return app;
}
