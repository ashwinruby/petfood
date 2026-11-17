import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
const digest = value => createHash('sha256').update(value).digest();
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export function registerOrders(app, options = {}) {
  const db = app.db;
  // Additive migration keeps issue #4 databases intact.
  const columns = db.prepare('PRAGMA table_info(orders)').all().map(column => column.name);
  for (const [name, declaration] of Object.entries({ fulfillment: "TEXT NOT NULL DEFAULT 'unfulfilled'", tracking_number: 'TEXT', tracking_url: 'TEXT', updated: 'INTEGER' })) {
    if (!columns.includes(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${declaration}`);
  }
  db.exec('CREATE TABLE IF NOT EXISTS admin_sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
  const adminKey = options.adminKey ?? process.env.ADMIN_ACCESS_KEY;
  if (adminKey && adminKey.length < 32) throw new Error('ADMIN_ACCESS_KEY must be at least 32 characters; generate a random secret.');
  const origin = options.origin ?? process.env.APP_ORIGIN ?? 'http://localhost:5173';
  const serialize = order => ({ ...order, items: JSON.parse(order.items), address: JSON.parse(order.address) });
  const publicColumns = 'id,created,mode,status,items,subtotal,shipping,total,address,fulfillment,tracking_number,tracking_url,updated';
  function admin(request) {
    if (!adminKey) throw fail('Administration is not configured.', 503);
    const token = request.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('goodbowl_admin='))?.slice(15);
    if (!token || !/^[a-f0-9]{64}$/.test(token) || !db.prepare('SELECT hash FROM admin_sessions WHERE hash=? AND expires>?').get(digest(token).toString('hex'), Date.now())) throw fail('Administrator authentication required.', 401);
  }
  app.post('/api/admin/session', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!adminKey) throw fail('Administration is not configured.', 503);
    const supplied = request.body?.key;
    if (typeof supplied !== 'string' || !timingSafeEqual(digest(supplied), digest(adminKey))) throw fail('Invalid administrator credentials.', 401);
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO admin_sessions VALUES (?,?)').run(digest(token).toString('hex'), Date.now() + 3600000);
    reply.header('Set-Cookie', `goodbowl_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=3600${origin.startsWith('https:') ? '; Secure' : ''}`);
    return { ok: true };
  });
  app.post('/api/admin/logout', async (request, reply) => {
    const token = request.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('goodbowl_admin='))?.slice(15);
    if (token) db.prepare('DELETE FROM admin_sessions WHERE hash=?').run(digest(token).toString('hex'));
    reply.header('Set-Cookie', 'goodbowl_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0');
    return { ok: true };
  });
  app.get('/api/order-history', async request => db.prepare(`SELECT ${publicColumns} FROM orders WHERE owner=? ORDER BY created DESC LIMIT 100`).all(app.sessionOwner(request)).map(serialize));
  app.get('/api/order-history/:id', async request => {
    const order = db.prepare(`SELECT ${publicColumns} FROM orders WHERE id=? AND owner=?`).get(request.params.id, app.sessionOwner(request));
    if (!order) throw fail('Order not found.', 404);
    return serialize(order);
  });
  app.get('/api/admin/orders', async request => { admin(request); return db.prepare(`SELECT ${publicColumns} FROM orders ORDER BY created DESC LIMIT 100`).all().map(serialize); });
  app.post('/api/admin/orders/:id', async request => {
    admin(request);
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(request.params.id);
    if (!order) throw fail('Order not found.', 404);
    if (!['paid', 'demo'].includes(order.status)) throw fail('Only confirmed test/demo orders can be fulfilled.', 409);
    const { fulfillment, trackingNumber = '', trackingUrl = '' } = request.body ?? {};
    const transitions = { unfulfilled: ['processing'], processing: ['shipped'], shipped: ['delivered'], delivered: [] };
    if (fulfillment !== order.fulfillment && !transitions[order.fulfillment].includes(fulfillment)) throw fail('Invalid fulfillment transition.', 409);
    if (typeof trackingNumber !== 'string' || trackingNumber.length > 100 || /[\x00-\x1f]/.test(trackingNumber)) throw fail('Invalid tracking number.');
    if (typeof trackingUrl !== 'string' || trackingUrl.length > 1000) throw fail('Invalid tracking URL.');
    if (trackingUrl) {
      let url; try { url = new URL(trackingUrl); } catch { throw fail('Tracking URL must be HTTPS.'); }
      if (url.protocol !== 'https:' || url.username || url.password) throw fail('Tracking URL must be HTTPS without credentials.');
    }
    if (['shipped', 'delivered'].includes(fulfillment) && !trackingNumber.trim()) throw fail('A tracking number is required for shipped orders.');
    db.prepare('UPDATE orders SET fulfillment=?,tracking_number=?,tracking_url=?,updated=? WHERE id=?').run(fulfillment, trackingNumber.trim(), trackingUrl, Date.now(), order.id);
    return { ok: true };
  });
}
