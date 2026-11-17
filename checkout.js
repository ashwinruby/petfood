import './checkout.css';
const cart = document.querySelector('#cart');
if (cart) {
  const history = document.createElement('a');
  history.href = '/orders.html'; history.textContent = 'Your test orders'; history.dataset.orderHistory = ''; history.className = 'order-status-link';
  cart.append(history);
  const start = document.createElement('button');
  start.type = 'button'; start.className = 'button checkout-start'; start.textContent = 'Try demo checkout';
  cart.insertBefore(start, document.querySelector('#continue-shopping'));
  const dialog = document.createElement('dialog');
  dialog.id = 'checkout-dialog';
  dialog.innerHTML = `<div class="cart-header"><h2>Checkout preview</h2><button type="button" data-close aria-label="Close checkout">×</button></div>
    <p class="checkout-notice">Test environment only. No real purchase or delivery. Use fictional details; do not enter personal information.</p>
    <form id="checkout-form"><div id="checkout-fields">
      <label>Full name<input name="name" required maxlength="100" autocomplete="off" placeholder="Demo Customer"></label>
      <label>Email<input name="email" type="email" required maxlength="254" autocomplete="off" placeholder="demo@example.com"></label>
      <label>Street address<input name="line1" required maxlength="200" autocomplete="off" placeholder="123 Test Street"></label>
      <label>City<input name="city" required maxlength="100" autocomplete="off" placeholder="Test City"></label>
      <label>State<input name="state" required maxlength="100" autocomplete="off" placeholder="Test State"></label>
      <label>Indian PIN code<input name="postalCode" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="110001"></label>
    </div><div id="checkout-summary"></div><p><small>Sample shipping: ₹99, free from ₹1,500. Live policies and shipping rates are not yet approved.</small></p>
    <p class="checkout-policy-links"><a href="/support.html#shipping">Shipping</a> · <a href="/support.html#returns">Returns</a> · <a href="/support.html#privacy">Privacy</a> · <a href="/support.html#terms">Terms</a></p>
    <button class="button" id="checkout-submit" type="submit">Create demo order</button></form><p id="checkout-status" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const status = dialog.querySelector('#checkout-status');
  const submit = dialog.querySelector('#checkout-submit');
  const money = cents => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cents / 100);
  let basket, requestKey, busy = false;
  const api = async (url, body) => {
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data; try { data = await response.json(); } catch { throw new Error('Checkout API is unavailable. Start the local API server to try the demo.'); }
    if (!response.ok) throw new Error(data.error || 'Unable to complete checkout.');
    return data;
  };
  dialog.querySelector('[data-close]').onclick = () => { if (!busy) dialog.close(); };
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  start.onclick = async () => {
    cart.close(); dialog.showModal(); status.textContent = 'Checking availability…'; submit.disabled = true; form.hidden = false;
    requestKey = crypto.randomUUID();
    try {
      basket = JSON.parse(localStorage.getItem('goodbowl-basket') || '{}');
      await api('/api/session', {});
      const quote = await api('/api/checkout/quote', { basket });
      dialog.querySelector('#checkout-summary').textContent = `Items ${money(quote.subtotal)} · Shipping ${money(quote.shipping)} · Total ${money(quote.total)}`;
      submit.textContent = quote.mode === 'demo' ? 'Create demo order' : 'Continue to Stripe test payment';
      status.textContent = ''; submit.disabled = false;
    } catch (error) { status.textContent = error.message; }
  };
  form.onsubmit = async event => {
    event.preventDefault(); if (busy) return; busy = true; submit.disabled = true; status.textContent = 'Preparing your test order…';
    try {
      const order = await api('/api/checkout', { basket, address: Object.fromEntries(new FormData(form)), requestKey });
      if (order.checkoutUrl) {
        const url = new URL(order.checkoutUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unexpected payment destination.');
        location.assign(url.href); return;
      }
      form.hidden = true;
      status.textContent = order.status === 'demo' ? `Demo order ${order.id} saved. No payment was taken and nothing will be shipped.` : `Order ${order.id} is ${order.status}. Payment confirmation may still be pending.`;
      const link = document.createElement('a'); link.href = `/orders.html?order=${encodeURIComponent(order.id)}`; link.textContent = 'View order status'; link.className = 'order-status-link';
      // Available once the order-management PR is installed.
      if (document.querySelector('[data-order-history]')) status.append(' ', link);
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; submit.disabled = false; }
  };
  const params = new URLSearchParams(location.search);
  if (params.has('checkout') && params.has('order')) {
    dialog.showModal(); form.hidden = true;
    status.textContent = params.get('checkout') === 'cancelled' ? 'Payment was cancelled. No success is assumed; checking the order…' : 'Checking payment confirmation…';
    api(`/api/orders/${encodeURIComponent(params.get('order'))}`).then(order => {
      status.textContent = `Order ${order.id}: ${order.status}. ${order.status === 'paid' ? 'Test payment confirmed by the server. No real delivery.' : 'No payment success is assumed from this return link. Pending payment reservations expire with the provider session.'}`;
    }).catch(error => { status.textContent = error.message; });
  }
}
