export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
export function validateCatalogue(data) {
 if (!data || !Array.isArray(data.products)) throw new Error('Invalid catalogue');
 const ids = new Set(), variants = new Set();
 for (const p of data.products) {
  if (!/^[a-z0-9-]+$/.test(p.id) || ids.has(p.id) || !['dog','cat'].includes(p.pet) || typeof p.name !== 'string' || !p.name.trim() || typeof p.verified !== 'boolean' || !Array.isArray(p.variants) || !p.variants.length) throw new Error('Invalid product');
  ids.add(p.id);
  if (p.image && !(typeof p.image === 'string' && /^\/(?!\/)/.test(p.image))) throw new Error('Product images must be local paths');
  for (const v of p.variants) {
   if (!/^[a-z0-9-]+$/.test(v.id) || variants.has(v.id) || typeof v.weight !== 'string' || !v.weight.trim() || !Number.isFinite(v.price) || v.price <= 0 || !Number.isSafeInteger(Math.round(v.price * 100)) || !Number.isSafeInteger(v.stock) || v.stock < 0) throw new Error('Invalid variant');
   variants.add(v.id);
  }
  if (p.verified && (!p.image || !p.description || !p.ingredients || !p.nutrition || !p.feedingGuidance)) throw new Error('Verified products require complete product information');
 }
 return data.products;
}
export async function loadCatalogue() {
 const response = await fetch('/catalogue.json');
 if (!response.ok) throw new Error('Catalogue unavailable');
 return validateCatalogue(await response.json());
}
export function sanitizeBasket(value, products) {
 const basket = {};
 for (const p of products) for (const v of p.variants) {
  if (Number.isInteger(value?.[v.id]) && value[v.id] > 0 && v.stock > 0) basket[v.id] = Math.min(value[v.id], v.stock, 99);
 }
 return basket;
}
