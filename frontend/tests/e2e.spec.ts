import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:8081';

test.describe('Svelte 5 双版并存', () => {
  test('legacy 顶栏含 🧪 试用新版', async ({ page }) => {
    await page.goto(`${BASE}/?v=legacy`);
    await expect(page.locator('button:has-text("试用新版")')).toBeVisible();
  });
  test('svelte 顶栏含 ↩️ 旧版且输入框为暗色', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);
    await expect(page.locator('button:has-text("旧版")')).toBeVisible();
    const bg = await page.evaluate(() => {
      const el = document.querySelector('input[placeholder*="歌单 ID"]') as HTMLElement;
      return el ? getComputedStyle(el).backgroundColor : '';
    });
    // 暗色 input 应为半透明非纯白
    expect(bg).not.toBe('rgb(255, 255, 255)');
  });
  test('点击查看歌单详情未登录应弹 还未设置cookie! toast', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);
    await page.fill('input[placeholder*="歌单 ID"]', '123456');
    await page.click('button:has-text("查看")');
    await expect(page.locator('#globalToastContainer')).toContainText('还未设置cookie', { timeout: 4000 });
  });
  test('搜索回车应发 /Search', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);
    // 切到搜索 tab
    await page.click('button:has-text("搜索")');
    await page.fill('input[placeholder*="搜索歌曲"]', 'test');
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/Search') && r.method()==='POST'),
      page.press('input[placeholder*="搜索歌曲"]', 'Enter')
    ]);
    expect(req.url()).toContain('/Search');
  });
});
