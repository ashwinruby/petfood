import { test, expect } from '@playwright/test';
const base = process.env.SITE_URL || 'http://127.0.0.1:5173';
test('direct product link supports variants, prices, stock and persistent basket', async ({page}) => {
 await page.route('**/catalogue.json', async route => {
  const data = await (await route.fetch()).json();
  data.products[0].variants.push({id:'chicken-2kg',weight:'2 kg',price:1599,stock:3},{id:'chicken-5kg',weight:'5 kg',price:3599,stock:0});
  await route.fulfill({json:data});
 });
 await page.goto(`${base}/?product=chicken`);
 await expect(page).toHaveTitle('The Everyday Favorite — GoodBowl');
 await expect(page.getByRole('heading',{name:'The Everyday Favorite',exact:true})).toBeVisible();
 await expect(page.getByText('No customer reviews yet.',{exact:false})).toBeVisible();
 await page.getByLabel('Pack size').selectOption('chicken-2kg');
 await expect(page.locator('#detail-price')).toHaveText('₹1,599');
 await page.locator('#detail-add').click();
 await page.getByRole('button',{name:'Open basket'}).click();
 await expect(page.locator('#cart-total')).toHaveText('₹1,599');
 await expect(page.locator('#cart-items')).toContainText('2 kg');
 await page.keyboard.press('Escape');
 await page.getByLabel('Pack size').selectOption('chicken-5kg');
 await expect(page.locator('#detail-add')).toBeDisabled();
 await expect(page.locator('#detail-stock')).toHaveText('Out of stock');
 await page.reload();
 await expect(page.locator('#cart-count')).toHaveText('1');
});
test('product links work on mobile and unknown products have recovery', async ({page}) => {
 await page.setViewportSize({width:320,height:800});
 await page.goto(base);
 await page.getByRole('link',{name:'The Everyday Favorite',exact:true}).click();
 await expect(page).toHaveURL(/\?product=chicken/);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.getByRole('link',{name:'Back to all food'}).click();
 await expect(page.locator('.product')).toHaveCount(3);
 await page.goto(`${base}/?product=does-not-exist`);
 await expect(page.getByRole('heading',{name:'Product not found'})).toBeVisible();
 await page.getByRole('link',{name:'Browse products'}).click();
 await expect(page.locator('.product')).toHaveCount(3);
});
