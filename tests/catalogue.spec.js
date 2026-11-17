import { test, expect } from '@playwright/test';
const base = process.env.SITE_URL || 'http://127.0.0.1:5173';
test('catalogue stock limits, untrusted copy and stale baskets are handled', async ({page}) => {
 await page.route('**/catalogue.json', async route => {
  const data = await (await route.fetch()).json();
  data.products[0].name = '<img src=x onerror=alert(1)>';
  data.products[0].variants[0].stock = 1;
  data.products[1].variants[0].stock = 0;
  await route.fulfill({json:data});
 });
 await page.goto(base);
 await page.evaluate(() => localStorage.setItem('goodbowl-basket', JSON.stringify({chicken:50,salmon:5,unknown:1})));
 await page.reload();
 await expect(page.locator('#cart-count')).toHaveText('1');
 await expect(page.locator('.product').first().locator('h3')).toHaveText('<img src=x onerror=alert(1)>');
 await expect(page.locator('.product').nth(1).getByRole('button')).toBeDisabled();
 await page.locator('.product').first().getByRole('button').click();
 await expect(page.locator('#cart-count')).toHaveText('1');
 await expect(page.locator('#toast')).toContainText('Maximum');
 await expect(page.locator('.sample-note')).toContainText('sample products');
});
test('invalid catalogue fails closed with a useful error', async ({page}) => {
 await page.route('**/catalogue.json', route => route.fulfill({json:{products:[{id:'broken'}]}}));
 await page.goto(base);
 await expect(page.getByRole('alert')).toContainText('could not be loaded');
 await expect(page.locator('[data-add]')).toHaveCount(0);
});
