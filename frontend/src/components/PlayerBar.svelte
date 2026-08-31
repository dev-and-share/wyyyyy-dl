<script lang="ts">
  import { formatTime } from '../lib/utils';
  import { queue, playerState, curTrack } from '../lib/player.svelte';
  let { audioEl, playing, curTime, duration, onToggle, onPrev, onNext, onSeek, onLyric, onQueue } = $props<{
    audioEl?: HTMLAudioElement, playing:boolean, curTime:number, duration:number,
    onToggle:()=>void, onPrev:()=>void, onNext:()=>void, onSeek:(e:MouseEvent)=>void, onLyric:()=>void, onQueue:()=>void
  }>();
  let vol=$state(playerState.volume);
  $effect(()=>{ if(audioEl) audioEl.volume=vol; playerState.volume=vol; });
</script>

{#if queue.length}
<div class="bottom-audio-bar" style="display:flex;">
  <audio bind:this={audioEl} src={curTrack?.url||''}></audio>
  <div class="audio-bar-inner">
    <div class="audio-left-section" onclick={onLyric} style="cursor:pointer;">
      <div class="vinyl-cover-wrapper"><img src={curTrack?.cover||'/favicon.png'} alt="" class="audio-cover" class:playing={playing} /></div>
      <div class="audio-text">
        <div class="audio-title-row"><div class="audio-title">{curTrack?.name||'未在播放'}</div></div>
        <div class="audio-artist">{curTrack?.artist||''}</div>
      </div>
    </div>
    <div class="audio-center-section">
      <div class="audio-main-controls">
        <button class="ctrl-btn sub-btn" onclick={()=>{ playerState.playMode=playerState.playMode==='single'?'list':'single'; }}>{playerState.playMode==='single'?'🔂':'🔁'}</button>
        <button class="ctrl-btn sub-btn" onclick={onPrev}>⏮</button>
        <button class="ctrl-btn play-main-btn" onclick={onToggle}>{playing?'⏸':'▶'}</button>
        <button class="ctrl-btn sub-btn" onclick={onNext}>⏭</button>
      </div>
      <div class="audio-progress-container">
        <span class="time-stamp">{formatTime(curTime)}</span>
        <div class="progress-bar-wrapper" onclick={onSeek}>
          <div class="progress-bar-bg"></div>
          <div class="progress-bar-fill" style="width:{duration?curTime/duration*100:0}%"></div>
          <div class="progress-bar-handle" style="left:{duration?curTime/duration*100:0}%"></div>
        </div>
        <span class="time-stamp">{formatTime(duration)}</span>
      </div>
    </div>
    <div class="audio-right-section" style="display:flex; align-items:center; gap:6px;">
      <button class="ctrl-btn sub-btn" onclick={onLyric}>🎤</button>
      <button class="ctrl-btn sub-btn" onclick={onQueue}>📜 {queue.length}</button>
      <div class="volume-container"><input type="range" min="0" max="1" step="0.05" bind:value={vol} style="width:70px;" /></div>
      <button class="ctrl-btn mini-btn" onclick={()=>{ queue.length=0; }}>✕</button>
    </div>
  </div>
</div>
{/if}
