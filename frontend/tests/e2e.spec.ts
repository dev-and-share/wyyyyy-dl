import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:8080';

test.describe('全栈端到端功能冒烟套件', () => {

  test('冒烟 1: 双核路由互通（新版直达与无痕切回旧版）', async ({ page }) => {
    // 1. 访问 Svelte 5 新版主入口
    await page.goto(`${BASE}/svelte/index.html`);
    await expect(page).toHaveTitle(/网易云/);
    const switchLegacyBtn = page.getByTestId('btn-switch-legacy');
    await expect(switchLegacyBtn).toBeVisible();

    // 2. 点击「旧版」按键，能成功跳转或切回旧版（验证 Cookie 与 URL 参数）
    await switchLegacyBtn.click();
    await page.waitForURL(/(\/|\/\?v=legacy)/);
    // 旧版应渲染「试用新版」按钮或未登录二维码
    const legacyBtn = page.locator('button:has-text("试用新版")');
    const legacyQr = page.locator('text=扫码登录');
    await expect(legacyBtn.or(legacyQr)).toBeVisible({ timeout: 6000 });

    // 3. 验证直接访问 /?v=legacy 稳定可用
    await page.goto(`${BASE}/?v=legacy`);
    await expect(legacyBtn.or(legacyQr)).toBeVisible({ timeout: 6000 });
  });

  test('冒烟 2: 顶栏功能（主题切换与暗色设计契约）', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);

    // 验证暗色设计规范：输入框背景非刺眼纯白
    const bg = await page.evaluate(() => {
      const el = document.querySelector('input') as HTMLElement;
      return el ? getComputedStyle(el).backgroundColor : '';
    });
    expect(bg).not.toBe('rgb(255, 255, 255)');

    // 主题切换冒烟
    const themeBtn = page.getByTestId('btn-toggle-theme');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await page.waitForTimeout(300);
    await themeBtn.click();
    await page.waitForTimeout(300);
  });

  test('冒烟 3: Tab 视图切换（歌单 / 搜索 / 本地管理）', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);

    // 1. 默认展示歌单 Tab
    await expect(page.getByTestId('tab-playlist')).toBeVisible();
    await expect(page.getByPlaceholder(/歌单 ID/)).toBeVisible();

    // 2. 切换到「搜索」Tab
    await page.getByTestId('tab-search').click();
    await expect(page.getByPlaceholder(/搜索歌曲/)).toBeVisible({ timeout: 4000 });

    // 3. 切换到「本地」管理 Tab
    await page.getByTestId('tab-download-mgr').click();
    await expect(page.locator('text=任务').first().or(page.locator('text=下载').first())).toBeVisible({ timeout: 4000 });

    // 4. 切回「歌单」Tab
    await page.getByTestId('tab-playlist').click();
    await expect(page.getByPlaceholder(/歌单 ID/)).toBeVisible();
  });

  test('冒烟 4: 真实音频播放管线与控制栏（防死锁健康检查）', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);

    // 1. 验证原生全局 <audio> 节点唯一存在
    const audioCount = await page.locator('audio').count();
    expect(audioCount).toBe(1);

    // 2. 模拟派发本地测试音频队列到播放器
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('svelte:playFolder', {
        detail: {
          name: '端到端冒烟测试曲目',
          tracks: [{
            id: 999999,
            songName: 'E2E测试歌曲',
            artist: '测试歌手',
            url: 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
            isLocal: true
          }]
        }
      }));
    });

    // 3. 验证播放控制条渲染歌曲信息
    await expect(page.locator('text=E2E测试歌曲').first()).toBeVisible({ timeout: 4000 });
    await expect(page.locator('text=测试歌手').first()).toBeVisible({ timeout: 4000 });

    // 4. 验证真实 audio.src 已被赋值为待播音频地址
    const audioSrc = await page.evaluate(() => {
      const a = document.querySelector('audio') as HTMLAudioElement;
      return a ? a.src : '';
    });
    expect(audioSrc).toContain('data:audio/wav');

    // 5. 验证播放器核心控制按键存在且使用 data-testid 稳定定位
    await expect(page.getByTestId('btn-play-pause').first()).toBeVisible({ timeout: 4000 });
    await expect(page.getByTestId('btn-next-track').first()).toBeVisible({ timeout: 4000 });
    await expect(page.getByTestId('btn-prev-track').first()).toBeVisible({ timeout: 4000 });
  });

  test('冒烟 5: 播放列表抽屉交互（展开与关闭）', async ({ page }) => {
    await page.goto(`${BASE}/svelte/index.html`);

    // 载入队列使播放条可见
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('svelte:playFolder', {
        detail: {
          name: '抽屉测试',
          tracks: [{ id: 8888, songName: '抽屉歌曲', artist: '歌手', url: 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA', isLocal: true }]
        }
      }));
    });

    // 点击列表抽屉按钮展开（使用 data-testid 稳定定位）
    const drawerBtn = page.getByTestId('btn-toggle-drawer').first();
    await expect(drawerBtn).toBeVisible({ timeout: 4000 });
    await drawerBtn.click();

    // 验证抽屉面板正常浮现
    const drawer = page.getByTestId('playlist-drawer');
    await expect(drawer).toBeVisible({ timeout: 4000 });
    await expect(drawer.locator('text=抽屉歌曲').first()).toBeVisible({ timeout: 4000 });
  });

});
