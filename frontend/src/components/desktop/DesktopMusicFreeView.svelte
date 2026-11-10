<script lang="ts">
  import { t } from '../../lib/i18n';
  import { musicFreeStore } from '../../lib/musicfree/musicFreeStore.svelte';
  import type { Track } from '../../lib/types';
  import MusicFreeTopListsTab from './musicfree/MusicFreeTopListsTab.svelte';
  import MusicFreeSheetsTab from './musicfree/MusicFreeSheetsTab.svelte';
  import MusicFreeManageTab from './musicfree/MusicFreeManageTab.svelte';
  import DesktopViewHeader from './DesktopViewHeader.svelte';
  import SegmentedTabs from '../sp/SegmentedTabs.svelte';
  import SwipeableTabsView from '../sp/SwipeableTabsView.svelte';
  import { layoutState } from '../../lib/layout.svelte';

  let {
    curTrack = null,
    playing = false,
    onPlayQueue,
    showToast
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  type TabId = 'toplists' | 'sheets' | 'manage';
  const SUBTABS: TabId[] = ['toplists', 'sheets', 'manage'];
  let activeTab = $state<TabId>('toplists');
  const activeCount = $derived(musicFreeStore.getActivePlugins().length);
  const activeTabIndex = $derived(SUBTABS.indexOf(activeTab));

  function handleSwipeIndexChange(index: number) {
    if (SUBTABS[index]) {
      activeTab = SUBTABS[index];
    }
  }
</script>

<div class="w-full flex flex-col gap-2 md:gap-4 select-none animate-fade-in" data-testid="desktop-musicfree-view">
  <!-- 📱 移动端 SP 专属：统一全宽分段 Tab 切换器 (隐藏冗余大标题，Full Width 等分) -->
  <div class="block lg:hidden w-full">
    <SegmentedTabs
      items={[
        { id: 'toplists', label: t('musicfree.tabToplists'), icon: '🏆', accent: 'purple' },
        { id: 'sheets', label: t('musicfree.tabSheets'), icon: '📻', accent: 'purple' },
        { id: 'manage', label: t('musicfree.tabManage'), icon: '⚙️', badge: activeCount, accent: 'purple' }
      ]}
      activeId={activeTab}
      onChange={(id) => activeTab = id as any}
    />
  </div>

  <!-- 🖥️ PC 桌面端统一顶栏 (>= lg 显示) -->
  <div class="hidden lg:block w-full">
    <DesktopViewHeader
      icon="🧩"
      title={t('musicfree.title')}
      badge={t('musicfree.activePluginsCount', { count: activeCount })}
      badgeType="purple"
    >
      {#snippet actions()}
        <div class="flex items-center gap-1.5 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-[var(--border-subtle)] shrink-0 self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {activeTab === 'toplists' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
            onclick={() => activeTab = 'toplists'}
          >
            <span>🏆</span> <span>{t('musicfree.tabToplists')}</span>
          </button>

          <button
            type="button"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {activeTab === 'sheets' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
            onclick={() => activeTab = 'sheets'}
          >
            <span>📻</span> <span>{t('musicfree.tabSheets')}</span>
          </button>

          <button
            type="button"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all flex items-center gap-1.5 {activeTab === 'manage' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
            onclick={() => activeTab = 'manage'}
          >
            <span>⚙️</span> <span>{t('musicfree.tabManage')}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded-full {activeCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-[var(--text-muted)]'}">
              {activeCount}
            </span>
          </button>
        </div>
      {/snippet}
    </DesktopViewHeader>
  </div>

  <!-- 🛝 原生合成器级 120Hz 零卡顿丝滑滚动容器 (支持移动端手势左右横滑切 Tab) -->
  <SwipeableTabsView
    activeIndex={activeTabIndex}
    count={SUBTABS.length}
    onChange={handleSwipeIndexChange}
  >
    <div class="w-full flex-1 flex flex-col">
      <MusicFreeTopListsTab
        {curTrack}
        {playing}
        {onPlayQueue}
        {showToast}
      />
    </div>

    <div class="w-full flex-1 flex flex-col">
      <MusicFreeSheetsTab
        {curTrack}
        {playing}
        {onPlayQueue}
        {showToast}
      />
    </div>

    <div class="w-full flex-1 flex flex-col">
      <MusicFreeManageTab
        {showToast}
      />
    </div>
  </SwipeableTabsView>
</div>
