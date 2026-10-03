<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../lib/api';

  let { showToast = () => {} } = $props<{
    showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', dur?: number) => void;
  }>();

  let isCheckingLogin = $state(false);
  let isLoggedIn = $state<boolean | null>(null);
  let showCookieInput = $state(false);
  let cookieText = $state('');
  let isSavingCookie = $state(false);

  export async function checkLogin() {
    isCheckingLogin = true;
    try {
      const res = await api.loginStatus();
      isLoggedIn = res?.code === '000000' && res?.data === true;
    } catch {
      isLoggedIn = false;
    } finally {
      isCheckingLogin = false;
    }
  }

  async function saveCookie() {
    if (!cookieText.trim()) {
      showToast('请输入有效 Cookie 内容', 'warning');
      return;
    }
    isSavingCookie = true;
    try {
      const res = await api.setCookie(cookieText.trim());
      if (res?.code === '000000') {
        showToast('Cookie 保存成功！', 'success');
        cookieText = '';
        showCookieInput = false;
        checkLogin();
      } else {
        showToast(res?.msg || '保存 Cookie 失败', 'warning');
      }
    } catch (e: any) {
      showToast('保存异常: ' + (e?.message || e), 'error');
    } finally {
      isSavingCookie = false;
    }
  }

  onMount(() => {
    checkLogin();
  });
</script>

<section class="flex flex-col gap-2.5">
  <div class="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <div class="flex items-center gap-1.5">
      <span>👤</span>
      <span>网易云账号与 Cookie</span>
    </div>
    <button
      type="button"
      class="text-[11px] text-red-500 hover:underline cursor-pointer bg-transparent border-none p-0"
      onclick={checkLogin}
    >
      {isCheckingLogin ? '检测中...' : '检测状态'}
    </button>
  </div>

  <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-xs text-[var(--text-secondary)]">授权状态：</span>
      {#if isCheckingLogin}
        <span class="text-xs text-[var(--text-muted)]">检测中...</span>
      {:else if isLoggedIn}
        <span class="text-xs font-semibold text-emerald-500 flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span> 已配置账号 / VIP 活跃
        </span>
      {:else}
        <span class="text-xs font-semibold text-amber-500 flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-amber-500"></span> 游客模式 / Cookie 未登录
        </span>
      {/if}
    </div>

    <div class="pt-2 border-t border-[var(--border-color)] flex items-center gap-2">
      <button
        type="button"
        class="flex-1 py-1.5 px-3 rounded-xl bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)] cursor-pointer transition-all"
        onclick={() => showCookieInput = !showCookieInput}
      >
        {showCookieInput ? '收起 Cookie 录入' : '配置 Cookie'}
      </button>
      <a
        href="/login"
        target="_blank"
        rel="noreferrer"
        class="py-1.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-500 border border-red-500/20 cursor-pointer transition-all text-center no-underline shrink-0"
      >
        扫码登录
      </a>
    </div>

    {#if showCookieInput}
      <div class="pt-2 flex flex-col gap-2">
        <textarea
          bind:value={cookieText}
          rows="3"
          placeholder="在此粘贴 MUSIC_U 或完整 Cookie 字符串..."
          class="w-full p-2 text-xs rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-main)] outline-none focus:border-red-500 resize-none font-mono"
        ></textarea>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1 text-xs rounded-lg border border-[var(--border-color)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer"
            onclick={() => { showCookieInput = false; cookieText = ''; }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={isSavingCookie}
            class="px-3 py-1 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold cursor-pointer border-none disabled:opacity-50"
            onclick={saveCookie}
          >
            {isSavingCookie ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</section>
