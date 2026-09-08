<script lang="ts">
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import { formatArtist } from '../lib/utils';

  let {
    open = $bindable(false),
    onToggle,
    songId = $bindable(''),
    songLevel = $bindable('lossless'),
    songInfo = null,
    onViewSong,
    onPlayQueue,
    onDownloadSingle,
    onAlbum
  } = $props<{
    open: boolean;
    onToggle: () => void;
    songId: string;
    songLevel: string;
    songInfo: any;
    onViewSong: (id: string) => void;
    onPlayQueue: (tracks: any[]) => void;
    onDownloadSingle: (id: string, name?: string) => void;
    onAlbum?: (albumId: string) => void;
  }>();
</script>

<!-- Section 3: 查看歌曲信息 -->
<AccordionCard title="🎧 3. 查看歌曲信息" bind:open={open} onToggle={onToggle}>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input
      type="text"
      placeholder="输入歌曲 ID (按回车查看)"
      class="flex-1 min-w-0"
      bind:value={songId}
      onkeydown={(e) => e.key === 'Enter' && onViewSong(songId)}
    />
    <select bind:value={songLevel} class="w-auto shrink-0">
      <option value="standard">标准</option>
      <option value="exhigh">极高</option>
      <option value="lossless">无损</option>
    </select>
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => onViewSong(songId)}>
      查看<span class="hidden sm:inline">单曲信息</span>
    </button>
  </div>

  {#if songInfo}
    {@const arText = formatArtist(songInfo) || '群星 / 未知'}
    {@const alText = songInfo.al_name || songInfo.album || '暂无专辑'}
    {@const sizeText = songInfo.size || '未知大小'}
    {@const levelText = songInfo.level || songLevel}
    {@const imgSrc = songInfo.pic || songInfo.picUrl || '/favicon.png'}

    <DetailHeaderCard
      cover={imgSrc}
      title={songInfo.name || songInfo.songName || '未知歌曲'}
      subtitle={`歌手：${arText} | 专辑：${alText}`}
      subDetail={`大小：${sizeText} | 音质：${levelText}`}
    >
      <button
        class="btn-primary"
        onclick={() => onPlayQueue([{
          id: songInfo.id || songId,
          name: songInfo.name || '单曲',
          artist: arText,
          cover: imgSrc,
          url: songInfo.url,
          lyric: songInfo.lyric
        }])}
      >
        ▶️ 试听
      </button>
      <button
        class="btn-secondary"
        onclick={() => onDownloadSingle(String(songInfo.id || songId), songInfo.name)}
      >
        📥 下载
      </button>
      {#if songInfo.al_id || songInfo.albumId || songInfo.al?.id}
        <button
          class="btn-secondary"
          onclick={() => {
            const aid = songInfo.al_id || songInfo.albumId || songInfo.al?.id;
            if (aid && onAlbum) onAlbum(String(aid));
          }}
        >
          💽 专辑
        </button>
      {/if}
    </DetailHeaderCard>

    <!-- 📄 查看 Raw JSON 响应数据 -->
    <div style="margin-top:10px;">
      <details style="border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; background:var(--tag-btn-bg);">
        <summary style="font-size:12px; color:var(--primary-color); cursor:pointer; font-weight:600; outline:none;">▶ 📄 查看 Raw JSON 响应数据</summary>
        <pre style="background:#0f172a; color:#38bdf8; padding:10px; border-radius:6px; font-size:11px; max-height:200px; overflow-y:auto; margin-top:6px; font-family:Consolas, monospace; border:1px solid rgba(255,255,255,0.06); white-space:pre-wrap;">{JSON.stringify(songInfo.rawData || songInfo, null, 2)}</pre>
      </details>
    </div>

    <!-- 歌词预览面板 -->
    <div style="margin-top:10px; font-size:12px; color:var(--text-secondary); max-height:150px; overflow-y:auto; background:var(--tag-btn-bg); padding:8px 12px; border-radius:6px; border:1px solid var(--border-subtle);">
      <pre style="margin:0; font-family:inherit; white-space:pre-wrap; line-height:1.6;">{songInfo.lyric || '暂无歌词'}</pre>
    </div>
  {:else}
    <div class="empty-placeholder-card">
      <div class="empty-icon">🎧</div>
      <div class="empty-title">在歌单中点击歌曲或输入歌曲 ID 查看</div>
    </div>
  {/if}
</AccordionCard>
