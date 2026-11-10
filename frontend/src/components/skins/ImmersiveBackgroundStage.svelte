<script lang="ts">
  import RainParticleCanvas from './effects/RainParticleCanvas.svelte';
  import SeasonParticleCanvas from './effects/SeasonParticleCanvas.svelte';

  let {
    skinId,
    playing = false,
    currentPauseTubeBgSrc = '/assets/skins/tube_minuet_pause_1.jpg'
  } = $props<{
    skinId: string;
    playing: boolean;
    currentPauseTubeBgSrc?: string;
  }>();
</script>

<!-- 动态全屏皮肤流光层（铺满 100vw × 100vh 大画布） -->
{#if skinId === 'aurora'}
  <div class="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
    <div
      class="aurora-orb orb-1 absolute -top-1/4 -left-1/4 w-[55vw] h-[55vw] min-w-[380px] min-h-[380px] rounded-full blur-[90px] md:blur-[130px] opacity-60 mix-blend-screen transition-colors duration-1000"
      style="background: var(--skin-dominant, #7c3aed); animation-play-state: {playing ? 'running' : 'paused'};"
    ></div>
    <div
      class="aurora-orb orb-2 absolute top-1/3 -right-1/4 w-[50vw] h-[50vw] min-w-[340px] min-h-[340px] rounded-full blur-[80px] md:blur-[120px] opacity-55 mix-blend-screen transition-colors duration-1000"
      style="background: var(--skin-accent, #db2777); animation-play-state: {playing ? 'running' : 'paused'};"
    ></div>
    <div
      class="aurora-orb orb-3 hidden md:block absolute -bottom-1/4 left-1/3 w-[45vw] h-[45vw] min-w-[300px] min-h-[300px] rounded-full blur-[90px] md:blur-[130px] opacity-40 mix-blend-screen transition-colors duration-1000"
      style="background: var(--skin-muted, #2563eb); animation-play-state: {playing ? 'running' : 'paused'};"
    ></div>
  </div>
{:else if skinId === 'spring'}
  <div class="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
    <div
      class="spring-pollen absolute -top-10 left-1/4 w-[50vw] h-[50vw] min-w-[340px] min-h-[340px] rounded-full blur-[100px] md:blur-[140px] bg-emerald-500/20 opacity-70 mix-blend-screen"
      style="animation-play-state: {playing ? 'running' : 'paused'};"
    ></div>
    <div
      class="spring-pollen absolute -bottom-10 right-1/4 w-[55vw] h-[55vw] min-w-[380px] min-h-[380px] rounded-full blur-[110px] md:blur-[150px] bg-teal-400/20 opacity-60 mix-blend-screen"
      style="animation-play-state: {playing ? 'running' : 'paused'};"
    ></div>
  </div>
{:else if skinId === 'rain'}
  <!-- 🌧️ 雨夜全景氛围大背景：咖啡馆少女 (方案 C 向左扩展留白，100% 满屏无缝铺满) -->
  <div
    data-testid="skin-companion-rain"
    class="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none"
    aria-hidden="true"
  >
    <!-- 播放态：街头摄影师隔窗望咖啡馆，女孩闭眸陶醉闻香 (rain_cafe_v2_playing.jpg) -->
    <img
      src="/assets/skins/rain_cafe_v2_playing.jpg"
      alt="Rain Cafe Girl Playing"
      class="absolute inset-0 w-full h-full object-cover object-center md:object-[100%_100%] transition-opacity duration-700 ease-in-out {playing ? 'opacity-100' : 'opacity-0'}"
      onerror={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.src.includes('/svelte/')) el.src = '/svelte' + (el.getAttribute('src') || ''); }}
    />
    <!-- 暂停态：女孩转头透过玻璃看向窗外街道（看向镜头/用户） (rain_cafe_v2_paused.jpg) -->
    <img
      src="/assets/skins/rain_cafe_v2_paused.jpg"
      alt="Rain Cafe Girl Paused"
      class="absolute inset-0 w-full h-full object-cover object-center md:object-[100%_100%] transition-opacity duration-700 ease-in-out {playing ? 'opacity-0' : 'opacity-100'}"
      onerror={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.src.includes('/svelte/')) el.src = '/svelte' + (el.getAttribute('src') || ''); }}
    />

    <!-- 电影级左侧微暗场渐变 (确保歌词在开阔的大落地窗前居中舒展，拥有顶级阅读对比度) -->
    <div
      class="absolute inset-0 hidden md:block pointer-events-none"
      style="background: linear-gradient(to right, rgba(6, 12, 24, 0.90) 0%, rgba(6, 12, 24, 0.72) 42%, rgba(6, 12, 24, 0.22) 72%, transparent 100%);"
    ></div>
    <!-- 移动端竖屏暗场渐变 (上下微暗，聚焦居中歌词) -->
    <div
      class="absolute inset-0 md:hidden pointer-events-none"
      style="background: linear-gradient(to bottom, rgba(6, 12, 24, 0.85) 0%, rgba(6, 12, 24, 0.45) 50%, rgba(6, 12, 24, 0.88) 100%);"
    ></div>
  </div>

  <!-- 🌧️ 全屏玻璃雨夜物理画布：真实水滴敲击窗户与重力水痕滑落 (置于全屏大图与暗角之上，通透晶莹) -->
  <RainParticleCanvas {playing} bottomOffset={110} />
{:else if skinId === 'tube'}
  <!-- 📻 复古胆机全景氛围大背景：整张温暖猫咪橱窗场景作为大背景铺满 (支持播放/暂停双帧神态无缝渐变，暂停时 3 种随机抬头神态) -->
  <div
    data-testid="skin-companion-tube-bg"
    class="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none"
    aria-hidden="true"
  >
    <!-- 播放态：整张大图铺满，小猫戴耳机眯眼享受音乐 (tube_minuet_playing.jpg，100% 满屏无缝铺满) -->
    <img
      src="/assets/skins/tube_minuet_playing.jpg"
      alt="Minuet Cat Playing Fullscreen"
      class="absolute inset-0 w-full h-full object-cover object-center md:object-[100%_100%] transition-opacity duration-700 ease-in-out {playing ? 'opacity-100' : 'opacity-0'}"
      onerror={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.src.includes('/svelte/')) el.src = '/svelte' + (el.getAttribute('src') || ''); }}
    />
    <!-- 暂停态：从 3 款抬头风格中随机抽取整张大图 (tube_minuet_pause_1/2/3.jpg) -->
    <img
      src={currentPauseTubeBgSrc}
      alt="Minuet Cat Paused Fullscreen"
      class="absolute inset-0 w-full h-full object-cover object-center md:object-[100%_100%] transition-opacity duration-700 ease-in-out {playing ? 'opacity-0' : 'opacity-100'}"
      onerror={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.src.includes('/svelte/')) el.src = '/svelte' + (el.getAttribute('src') || ''); }}
    />

    <!-- 电影级温润左侧微暗场渐变 (确保歌词在木质暗窗前居中舒展，拥有顶级阅读对比度) -->
    <div
      class="absolute inset-0 hidden md:block pointer-events-none"
      style="background: linear-gradient(to right, rgba(23, 11, 4, 0.88) 0%, rgba(23, 11, 4, 0.70) 38%, rgba(23, 11, 4, 0.18) 72%, transparent 100%);"
    ></div>
    <!-- 移动端竖屏暗场渐变 (上下微暗，聚焦居中歌词) -->
    <div
      class="absolute inset-0 md:hidden pointer-events-none"
      style="background: linear-gradient(to bottom, rgba(23, 11, 4, 0.85) 0%, rgba(23, 11, 4, 0.35) 50%, rgba(23, 11, 4, 0.88) 100%);"
    ></div>
  </div>
{:else if skinId === 'sakura' || skinId === 'summer' || skinId === 'autumn' || skinId === 'winter'}
  <!-- 四季动态全屏微风物理粒子画布 -->
  <SeasonParticleCanvas {skinId} {playing} bottomOffset={110} />
{/if}

<!-- 🎬 全屏沉浸模式专属：顶角电影聚焦暗角 (Top Corner Focus，以 2D 径向平滑晕染入中央舞台) -->
<div
  data-testid="immersive-titlebar-bg"
  class="absolute inset-0 z-20 pointer-events-none transition-colors duration-500"
  style="
    background:
      radial-gradient(ellipse 420px 320px at 0% 0%, var(--wco-titlebar-bg) 0%, var(--wco-titlebar-bg) 65px, color-mix(in srgb, var(--wco-titlebar-bg) 82%, transparent) 130px, color-mix(in srgb, var(--wco-titlebar-bg) 48%, transparent) 210px, color-mix(in srgb, var(--wco-titlebar-bg) 18%, transparent) 290px, transparent 100%),
      radial-gradient(ellipse 420px 320px at 100% 0%, var(--wco-titlebar-bg) 0%, var(--wco-titlebar-bg) 65px, color-mix(in srgb, var(--wco-titlebar-bg) 82%, transparent) 130px, color-mix(in srgb, var(--wco-titlebar-bg) 48%, transparent) 210px, color-mix(in srgb, var(--wco-titlebar-bg) 18%, transparent) 290px, transparent 100%);
  "
  aria-hidden="true"
></div>

<!-- 🎬 电影聚焦微暗角遮罩 (Cinematic Vignette)：四角深邃暗晕聚焦中央舞台，与左右系统切角浑然一体 -->
<div
  data-testid="immersive-cinematic-vignette"
  class="absolute inset-0 z-10 pointer-events-none transition-opacity duration-500"
  style="background: radial-gradient(ellipse 95% 85% at center, transparent 40%, rgba(0, 0, 0, 0.12) 70%, var(--wco-titlebar-bg) 100%);"
  aria-hidden="true"
></div>

<style>
  /* ── 极光流动动画（大画布全屏） ───────────────────────── */
  @keyframes drift1 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(6vw, 4vh) scale(1.15); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes drift2 {
    0%   { transform: translate(0, 0) scale(1.1); }
    50%  { transform: translate(-5vw, -3vh) scale(0.95); }
    100% { transform: translate(0, 0) scale(1.1); }
  }
  @keyframes drift3 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(4vw, -5vh) scale(1.1); }
    100% { transform: translate(0, 0) scale(1); }
  }

  .orb-1 { animation: drift1 18s ease-in-out infinite; will-change: transform; }
  .orb-2 { animation: drift2 22s ease-in-out infinite; will-change: transform; }
  .orb-3 { animation: drift3 26s ease-in-out infinite; will-change: transform; }

  /* ── 春日草木微粒动画（大画布全屏） ───────────────────── */
  @keyframes floatPollen {
    0%   { transform: translateY(0) scale(1); }
    50%  { transform: translateY(4vh) scale(1.08); }
    100% { transform: translateY(0) scale(1); }
  }
  .spring-pollen { animation: floatPollen 14s ease-in-out infinite; will-change: transform; }

  @media (prefers-reduced-motion: reduce) {
    .aurora-orb, .spring-pollen { animation: none !important; }
  }
</style>
