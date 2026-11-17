import { test, expect } from '@playwright/test';
const base = process.env.SITE_URL || 'http://127.0.0.1:5173';
test('homepage filters, basket persistence, removal and keyboard close', async ({ page }) => {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);
 await expect(page).toHaveTitle(/GoodBowl/);
 await expect(page.locator('.product')).toHaveCount(3);
 await page.getByRole('button',{name:'For cats',exact:true}).click();
 await expect(page.locator('.product')).toHaveCount(1);
 await page.getByRole('button',{name:'Add The Purrfect Bowl to basket'}).click();
 await page.getByRole('button',{name:'Open basket'}).click();
 await expect(page.locator('#cart-total')).toHaveText('₹799');
 await page.keyboard.press('Escape');
 await expect(page.locator('#cart')).not.toBeVisible();
 await page.reload();
 await expect(page.locator('#cart-count')).toHaveText('1');
 await page.getByRole('button',{name:'Open basket'}).click();
 await page.getByRole('button',{name:'Remove one The Purrfect Bowl'}).click();
 await expect(page.locator('#cart-total')).toHaveText('₹0');
 await expect(page.locator('.empty-cart')).toBeVisible();
 expect(errors).toEqual([]);
});
test('desktop and mobile render without overflow or broken images', async ({page})=>{
 for(const width of [320,390,620,621,700,768,900,1024,1440,1920]) {
 await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.hero img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await page.screenshot({path:`/tmp/goodbowl-${width}.png`,fullPage:true});
 }
});

for (const width of [320, 390, 700, 768, 1440]) {
 test(`sticky navigation and unobscured anchors at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  const header = page.locator('.site-header');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [name, target] of [['Shop food', '#shop'], ['Our difference', '#promise'], ['Our story', '#story']]) {
   await nav.getByRole('link', { name, exact: true }).click();
   await expect(page).toHaveURL(new RegExp(`${target}$`));
   await expect.poll(async () => (await header.boundingBox()).y).toBe(0);
   const headerBox = await header.boundingBox();
   const targetBox = await page.locator(target).boundingBox();
   expect(targetBox.y).toBeGreaterThanOrEqual(headerBox.height);
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Open basket' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close basket' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'GoodBowl home' }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
 });
}
