import './product-details.css';
import { escapeHTML as html, money } from './catalogue.js';
import { productArt } from './product-art.js';

export function showProductDetails(products, addToBasket) {
 const id = new URL(location.href).searchParams.get('product');
 if (!id) return;
 const main = document.querySelector('main');
 main.classList.add('detail-mode');
 const section = document.createElement('section');
 section.className = 'product-detail wrap';
 main.prepend(section);
 // Keep global navigation useful from a deep-linked product page.
 document.querySelectorAll('a[href^="#"]').forEach(link => link.setAttribute('href', `/${link.getAttribute('href')}`));
 const product = products.find(p => p.id === id);
 if (!product) {
  document.title = 'Product not found — GoodBowl';
  section.innerHTML = '<h1>Product not found</h1><p>This product may no longer be available.</p><a class="button" href="/#shop">Browse products</a>';
  return;
 }
 document.title = `${product.name} — GoodBowl`;
 const safe = Object.fromEntries(Object.entries(product).map(([key,value]) => [key, typeof value === 'string' ? html(value) : value]));
 safe.color = ['peach','sage','lavender'].includes(product.color) ? product.color : 'peach';
 const information = value => product.verified && value ? html(value) : 'Awaiting verified product information. Please do not use this sample for dietary decisions.';
 section.innerHTML = `<a class="text-link" href="/#shop">← Back to all food</a><div class="detail-grid"><div>${product.image ? `<div class="product-art"><img class="catalogue-photo" src="${html(product.image)}" alt="${html(product.name)} packaging"></div>` : productArt(safe)}</div><div><p class="eyebrow">FOR ${product.pet.toUpperCase()}S</p><h1>${html(product.name)}</h1><p>${html(product.flavor)}</p>${product.verified ? '' : '<p class="detail-notice">Sample product · Demo prices and stock · Not available for real purchase</p>'}<p>${html(product.description || 'Product description will be supplied before launch.')}</p><label for="pack-size">Pack size</label><select id="pack-size">${product.variants.map(v => `<option value="${v.id}">${html(v.weight)} — ${money(v.price)}${v.stock ? '' : ' — Out of stock'}</option>`).join('')}</select><p id="detail-price" class="detail-price"></p><p id="detail-stock" role="status"></p><button id="detail-add" class="button">Add to bag +</button></div></div><div class="detail-information"><section><h2>Ingredients</h2><p>${information(product.ingredients)}</p></section><section><h2>Nutrition</h2><p>${information(product.nutrition)}</p></section><section><h2>Feeding guidance</h2><p>${information(product.feedingGuidance)}</p></section><section><h2>Customer reviews</h2><p>No customer reviews yet. Reviews will appear here when genuine customer feedback is available.</p></section></div>`;
 const select = section.querySelector('#pack-size');
 const firstAvailable = product.variants.find(v => v.stock > 0);
 if (firstAvailable) select.value = firstAvailable.id;
 const updateVariant = () => {
  const variant = product.variants.find(v => v.id === select.value);
  section.querySelector('#detail-price').textContent = money(variant.price);
  section.querySelector('#detail-stock').textContent = variant.stock ? `${variant.stock} available${product.verified ? '' : ' (demo stock)'}` : 'Out of stock';
  section.querySelector('#detail-add').disabled = variant.stock === 0;
 };
 select.addEventListener('change', updateVariant);
 section.querySelector('#detail-add').addEventListener('click', () => addToBasket(select.value));
 updateVariant();
}
