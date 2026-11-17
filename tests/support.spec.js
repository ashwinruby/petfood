import { test, expect } from '@playwright/test';
const base = process.env.SITE_URL || 'http://127.0.0.1:5173';
test('footer help links, direct sections and mobile layout', async ({ page }) => {
  await page.goto(base);
  await page.getByRole('navigation', { name: 'Support and policies' }).getByRole('link', { name: 'Shipping', exact: true }).click();
  await expect(page).toHaveURL(/support.html#shipping$/);
  await expect(page.locator('#shipping .status')).toHaveText('Not published');
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('#contact-details')).toContainText('not yet available');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('link', { name: 'FAQs', exact: true }).click();
  await page.getByText('Why does my basket stay after I refresh?', { exact: true }).click();
  await expect(page.locator('details[open]')).toContainText('local storage');
});
test('only complete approved policies publish, with safe text rendering', async ({ page }) => {
  await page.route('**/support-config.json', route => route.fulfill({ json: {
    business: { name: 'Example shop', email: 'help@example.test' },
    policies: {
      shipping: { approved: true, updated: '2026-11-17', text: '<img src=x onerror=alert(1)> Approved shipping information.' },
      returns: { approved: false, updated: '2026-11-17', text: 'Unapproved promise' },
      privacy: { approved: true, updated: '', text: 'Missing approval date' }
    }
  } }));
  await page.goto(`${base}/support.html#shipping`);
  await expect(page.locator('#shipping .status')).toContainText('Published');
  await expect(page.locator('#shipping .policy-text')).toContainText('<img src=x');
  await expect(page.locator('#shipping img')).toHaveCount(0);
  await expect(page.locator('#returns .status')).toHaveText('Not published');
  await expect(page.locator('#privacy .status')).toHaveText('Not published');
  await expect(page.getByRole('link', { name: 'help@example.test' })).toHaveAttribute('href', 'mailto:help%40example.test');
  await expect(page.locator('#readiness')).toContainText('Store preview');
});
test('configuration failure preserves honest fallback', async ({ page }) => {
  await page.route('**/support-config.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto(`${base}/support.html#terms`);
  await expect(page.locator('#readiness')).toContainText('could not be loaded');
  await expect(page.locator('#terms .status')).toHaveText('Not published');
});
