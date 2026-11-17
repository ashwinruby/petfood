(() => {
  const admin = document.body.hasAttribute('data-admin');
  const root = document.querySelector('#orders'), status = document.querySelector('#status');
  const money = cents => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cents / 100);
  const element = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  async function api(url, body) {
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data; try { data = await response.json(); } catch { throw new Error('The order API is unavailable. Start the local API server.'); }
    if (!response.ok) throw new Error(data.error || 'Unable to load orders.');
    return data;
  }
  function render(order) {
    const card = element('article'); card.id = `order-${order.id}`;
    card.append(element('h2', `Order ${order.id}`), element('p', `${new Date(order.created).toLocaleString()} · ${order.mode} · Payment: ${order.status} · Fulfillment: ${order.fulfillment}`));
    if (order.status === 'demo') card.append(element('strong', 'Demo confirmation only — no payment taken or delivery scheduled.'));
    else if (order.status === 'paid') card.append(element('strong', 'Stripe test payment confirmed. No real purchase or delivery.'));
    const items = element('ul');
    order.items.forEach(item => items.append(element('li', `${item.quantity} × ${item.name} (${item.weight}) — ${money(item.price * item.quantity)}`)));
    card.append(items, element('p', `Subtotal ${money(order.subtotal)} · Shipping ${money(order.shipping)} · Total ${money(order.total)}`));
    const a = order.address;
    card.append(element('p', `Test delivery details: ${a.name}, ${a.line1}, ${a.city}, ${a.state} ${a.postalCode}, ${a.country}. Contact: ${a.email}`));
    if (order.tracking_number) card.append(element('p', `Tracking number: ${order.tracking_number}`));
    if (order.tracking_url) {
      try { const url = new URL(order.tracking_url); if (url.protocol === 'https:') { const link = element('a', 'Track shipment (external carrier)'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); } } catch {}
    }
    if (admin && ['paid', 'demo'].includes(order.status)) {
      const form = element('form');
      const field = (label, input) => { const wrap = element('label', label); wrap.append(input); form.append(wrap); return input; };
      const select = element('select'); select.name = 'fulfillment';
      for (const value of ['unfulfilled', 'processing', 'shipped', 'delivered']) { const option = element('option', value); option.value = value; option.selected = order.fulfillment === value; select.append(option); }
      field('Fulfillment status (forward transitions only)', select);
      const number = element('input'); number.name = 'trackingNumber'; number.maxLength = 100; number.value = order.tracking_number || ''; field('Tracking number', number);
      const url = element('input'); url.name = 'trackingUrl'; url.type = 'url'; url.maxLength = 1000; url.value = order.tracking_url || ''; field('HTTPS carrier tracking URL (optional)', url);
      const save = element('button', 'Update order'); form.append(save);
      const result = element('p'); result.setAttribute('role', 'status'); form.append(result);
      form.onsubmit = async event => { event.preventDefault(); save.disabled = true; try { await api(`/api/admin/orders/${encodeURIComponent(order.id)}`, Object.fromEntries(new FormData(form))); await load(); } catch (error) { result.textContent = error.message; } finally { save.disabled = false; } };
      card.append(form);
    }
    return card;
  }
  async function load() {
    status.textContent = 'Loading orders…'; root.replaceChildren();
    try {
      const orders = await api(admin ? '/api/admin/orders' : '/api/order-history');
      orders.forEach(order => root.append(render(order)));
      status.textContent = orders.length ? `${orders.length} order(s).` : 'No test orders yet. Add a product and try demo checkout.';
      if (admin) { document.querySelector('#login').hidden = true; document.querySelector('#admin-actions').hidden = false; }
      const id = new URLSearchParams(location.search).get('order'); if (id) document.getElementById(`order-${id}`)?.scrollIntoView();
    } catch (error) { status.textContent = error.message; if (admin) { document.querySelector('#login').hidden = false; document.querySelector('#admin-actions').hidden = true; } }
  }
  document.querySelector('#refresh').onclick = load;
  if (admin) {
    const login = document.querySelector('#login');
    login.onsubmit = async event => { event.preventDefault(); const key = new FormData(login).get('key'); login.reset(); try { await api('/api/admin/session', { key }); await load(); } catch (error) { status.textContent = error.message; } };
    document.querySelector('#logout').onclick = async () => { try { await api('/api/admin/logout', {}); root.replaceChildren(); login.hidden = false; document.querySelector('#admin-actions').hidden = true; status.textContent = 'Signed out.'; } catch (error) { status.textContent = error.message; } };
  }
  load();
})();
