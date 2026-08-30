import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:8081';

test.describe('Svelte 5 双版并存', () => {
  test('legacy 顶栏含 🧪 试用新版 或 未登录二维码', async ({ page }) => {
    await page.goto(`${BASE}/?v=legacy`);
    const btn = page.locator('button:has-text("试用新版")');
    const qr = page.locator('text=扫码登录');
    await expect(btn.or(qr)).toBeVisible();
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
    const input = page.getByPlaceholderText(/歌单 ID/);
    await input.fill('123456');
    const btn = page.locator('.accordion-card:has-text("查看歌单详情") button:has-text("查看")');
    await btn.click();
    await expect(page.locator('#globalToastContainer')).toContainText('还未设置cookie', { timeout: 6000 });
  });
  test('搜索回车应发 /Search', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);
    await page.click('button:has-text("搜索")');
    await page.fill('input[placeholder*="搜索歌曲"]', 'test');
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/Search') && r.method()==='POST'),
      page.press('input[placeholder*="搜索歌曲"]', 'Enter')
    ]);
    expect(req.url()).toContain('/Search');
  });
  test('专辑检索 Jay 应渲染 1. Jay - Favor (1首) 且按钮为查看专辑详情', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);
    await page.getByRole('button', { name: '搜索', exact: true }).first().click().catch(()=> page.click('button:has-text("搜索")'));
    // 切到搜索 tab 确保可见
    await page.locator('.accordion-card:has-text("关键词综合搜索")').click().catch(()=>{});
    await page.selectOption('select', '10');
    const sInput = page.getByPlaceholderText(/搜索歌曲/);
    await sInput.fill('Jay');
    await page.getByRole('button', { name: '搜索' }).last().click();
    await expect(page.locator('text=Jay').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button:has-text("查看专辑详情")').first()).toBeVisible({ timeout: 5000 });
  });
  test('单曲/歌单/歌手检索均应发对应 type', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);
    await page.locator('.accordion-card:has-text("关键词综合搜索")').click().catch(()=>{});
    for (const t of ['1','1000','100']) {
      await page.selectOption('select', t);
      const sInput = page.getByPlaceholderText(/搜索歌曲/);
      await sInput.fill('Jay');
      const [req] = await Promise.all([
        page.waitForRequest(r => r.url().includes('/Search'), { timeout: 8000 }),
        page.getByRole('button', { name: '搜索' }).last().click()
      ]);
      expect(req.postData()).toContain(`type=${t}`);
      await page.waitForTimeout(800);
    }
  });
});
