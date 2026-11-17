const policyIds = ['shipping', 'returns', 'privacy', 'terms'];
const paragraph = (text, className) => {
  const element = document.createElement('p');
  element.textContent = text;
  if (className) element.className = className;
  return element;
};
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

async function loadSupport() {
  try {
    const response = await fetch('/support-config.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Support configuration unavailable');
    const config = await response.json();
    const business = config.business || {};
    // Only render usable contacts. Values are always text, never executable HTML.
    const email = typeof business.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.email) ? business.email : '';
    const phone = typeof business.phone === 'string' && /^\+?[\d ()-]{7,25}$/.test(business.phone) ? business.phone : '';
    if (email || phone) {
      const contact = document.querySelector('#contact-details');
      contact.replaceChildren();
      if (nonempty(business.name)) contact.append(paragraph(business.name));
      for (const [value, scheme] of [[email, 'mailto:'], [phone, 'tel:']]) {
        if (!value) continue;
        const p = document.createElement('p');
        const link = document.createElement('a');
        link.textContent = value;
        link.href = scheme + (scheme === 'mailto:' ? encodeURIComponent(value) : value.replace(/[ ()-]/g, ''));
        p.append(link); contact.append(p);
      }
      if (nonempty(business.address)) contact.append(paragraph(business.address));
      if (nonempty(business.hours)) contact.append(paragraph(`Support hours: ${business.hours}`));
    }
    let published = 0;
    for (const id of policyIds) {
      const policy = config.policies?.[id];
      if (policy?.approved !== true || !nonempty(policy.text) || !/^\d{4}-\d{2}-\d{2}$/.test(policy.updated || '')) continue;
      const content = document.querySelector(`#${id} .policy-content`);
      content.replaceChildren(paragraph(`Published · Updated ${policy.updated}`, 'status'), paragraph(policy.text, 'policy-text'));
      published++;
    }
    if ((email || phone) && published === policyIds.length) {
      document.querySelector('#readiness').textContent = 'Support details and policies are published below. The storefront and checkout notices indicate whether purchases are available.';
    }
  } catch {
    document.querySelector('#readiness').textContent = 'Support information could not be loaded. The preview notices below are not approved purchase policies. Please try again later; do not send personal or payment information to this demo.';
  }
}
loadSupport();
