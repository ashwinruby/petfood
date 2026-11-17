import './style.css';
import './catalogue.css';
import { loadCatalogue, sanitizeBasket, escapeHTML as html, money } from './catalogue.js';
import { productArt } from './product-art.js';
const header = document.querySelector('.site-header');
const updateHeaderHeight = () => document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
updateHeaderHeight();
new ResizeObserver(updateHeaderHeight).observe(header);
let products = [], basket = {}, currentFilter = 'all';
const cart = document.querySelector('#cart');
const grid = document.querySelector('#products');
function renderProducts() {
 grid.innerHTML = products.filter(p => currentFilter === 'all' || p.pet === currentFilter).map(p => {
  const v = p.variants.find(v => v.stock > 0) || p.variants[0];
  const safe = Object.fromEntries(Object.entries(p).map(([key,value]) => [key, typeof value === 'string' ? html(value) : value]));
  safe.color = ['peach','sage','lavender'].includes(p.color) ? p.color : 'peach';
  return `<article class="product">${p.image ? `<div class="product-art"><img class="catalogue-photo" src="${html(p.image)}" alt="${html(p.name)} packaging" loading="lazy"></div>` : productArt(safe)}<div class="product-info"><span class="pet-label">FOR ${p.pet.toUpperCase()}S <span>· ${html(v.weight)}</span></span><h3>${html(p.name)}</h3><p>${html(p.flavor)}</p><p class="stock-status">${v.stock ? `${v.stock} available${p.verified ? '' : ' (demo stock)'}` : 'Out of stock'}</p><div class="product-bottom"><strong>${money(v.price)}</strong><button data-add="${v.id}" aria-label="Add ${html(p.name)} to basket" ${v.stock ? '' : 'disabled'}>Add to bag <span>+</span></button></div></div></article>`;
 }).join('') || '<p>No products in this category yet.</p>';
}
function updateCart() {
 basket = sanitizeBasket(basket, products);
 let count = 0, total = 0;
 const rows = [];
 for (const p of products) for (const v of p.variants) if (basket[v.id]) {
  count += basket[v.id]; total += v.price * basket[v.id];
  rows.push(`<div class="cart-row"><div><strong>${html(p.name)}</strong><p>${html(v.weight)} · ${basket[v.id]} × ${money(v.price)}</p></div><button data-remove="${v.id}" aria-label="Remove one ${html(p.name)}">−</button></div>`);
 }
 document.querySelector('#cart-items').innerHTML = rows.join('') || '<p class="empty-cart">A happy bowl starts here.<br>Explore the menu and add a favorite.</p>';
 document.querySelector('#cart-count').textContent = count;
 document.querySelector('#cart-total').textContent = money(total);
 try { localStorage.setItem('goodbowl-basket', JSON.stringify(basket)); } catch {}
 document.dispatchEvent(new CustomEvent('goodbowl:basket-updated', {detail: {basket: {...basket}}}));
}
let timer;
function addToBasket(id) {
 const variant = products.flatMap(p => p.variants).find(v => v.id === id);
 if (!variant || !variant.stock) return;
 const old = basket[id] || 0;
 basket[id] = Math.min(old + 1, variant.stock, 99);
 updateCart();
 const toast = document.querySelector('#toast');
 toast.textContent = basket[id] > old ? 'A little goodness added to your bag ✓' : 'Maximum available quantity is already in your bag.';
 toast.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('show'), 2600);
}
grid.addEventListener('click', event => { const button = event.target.closest('[data-add]'); if (button) addToBasket(button.dataset.add); });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
 document.querySelectorAll('[data-filter]').forEach(other => { other.classList.toggle('active', other === button); other.setAttribute('aria-pressed', String(other === button)); });
 currentFilter = button.dataset.filter; renderProducts();
}));
document.querySelector('#open-cart').onclick = () => cart.showModal();
document.querySelector('#close-cart').onclick = () => cart.close();
document.querySelector('#continue-shopping').onclick = () => cart.close();
cart.addEventListener('click', event => {
 const button = event.target.closest('[data-remove]');
 if (button) { if (--basket[button.dataset.remove] <= 0) delete basket[button.dataset.remove]; updateCart(); }
 if (event.target === cart) { const r = cart.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) cart.close(); }
});
document.querySelector('#year').textContent = new Date().getFullYear();
async function initialize() {
 grid.setAttribute('aria-busy', 'true');
 try {
  products = await loadCatalogue();
  try { basket = sanitizeBasket(JSON.parse(localStorage.getItem('goodbowl-basket') || '{}'), products); } catch {}
  renderProducts(); updateCart();
  document.querySelector('.sample-note').textContent = products.some(p => !p.verified) ? 'Concept catalogue: sample products, prices and stock. No real purchases. Product information is awaiting verification.' : 'Browse our products. Availability is confirmed at checkout.';
 } catch {
  grid.innerHTML = '<p role="alert">The catalogue could not be loaded. Please refresh to try again.</p>';
 } finally { grid.removeAttribute('aria-busy'); }
}
initialize();
