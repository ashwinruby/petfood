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
 for(const width of [1440,390]) {
 await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.hero img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await page.screenshot({path:`/tmp/goodbowl-${width}.png`,fullPage:true});
 }
});
