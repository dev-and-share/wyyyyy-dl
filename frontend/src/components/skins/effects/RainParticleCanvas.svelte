<script lang="ts">
  import { audioVisualizer } from '../../../lib/player/audioVisualizer.svelte';

  let {
    playing = false,
    bottomOffset = 0
  } = $props<{
    playing: boolean;
    bottomOffset?: number;
  }>();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let animId = 0;

  // 玻璃上的真实水滴模型 (带重力张力、停顿流淌与滞留微痕)
  interface GlassDrop {
    x: number;
    y: number;
    radius: number;
    targetRadius: number;
    mass: number;
    threshold: number;
    vy: number;
    isSliding: boolean;
    slidePauseTimer: number; // 停顿流淌节奏感 (Staccato Trickling)
    tail: { x: number; y: number; r: number; alpha: number }[];
  }

  // 窗外远处倾斜飞速下落的密集雨丝 (远景景深雨)
  interface RainStreak {
    x: number;
    y: number;
    len: number;
    speed: number;
    thickness: number;
    alpha: number;
  }

  // 玻璃表面的静态微小水汽凝露 (窗户温差雾气微露)
  interface MicroDew {
    x: number;
    y: number;
    r: number;
    alpha: number;
  }

  // 雨点撞击玻璃瞬间激起的飞溅水花与飞溅微珠
  interface SplashRing {
    x: number;
    y: number;
    r: number;
    maxR: number;
    alpha: number;
    particles: { x: number; y: number; vx: number; vy: number; alpha: number }[];
  }

  // 远景雨雾夜景梦幻散景光斑 (径向羽化衰减)
  interface BokehLight {
    x: number;
    y: number;
    radius: number;
    r: number;
    g: number;
    b: number;
    maxAlpha: number;
    pulseOffset: number;
  }

  $effect(() => {
    if (!canvasEl) return;
    const canvas = canvasEl;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    let isVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
    const onVisibilityChange = () => {
      isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      if (isVisible) {
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animId);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // ─────────────────────────────────────────────────────────────
    // 1. 纯净静谧的窗外倾斜细雨丝 (仅 14 条极轻细雨丝，营造景深氛围，绝不干扰文字)
    // ─────────────────────────────────────────────────────────────
    const streaks: RainStreak[] = [];
    for (let i = 0; i < 16; i++) {
      streaks.push({
        x: Math.random() * (width + 200) - 100,
        y: Math.random() * height,
        len: 20 + Math.random() * 35,
        speed: 12 + Math.random() * 10,
        thickness: 0.5 + Math.random() * 0.5,
        alpha: 0.05 + Math.random() * 0.10
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. 玻璃表面的微润凝露 (仅 24 颗极透微露，杜绝背景杂乱噪点)
    // ─────────────────────────────────────────────────────────────
    const microDews: MicroDew[] = [];
    for (let i = 0; i < 24; i++) {
      microDews.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 1.2,
        alpha: 0.12 + Math.random() * 0.18
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3. 玻璃上的通透纯净水滴 (32 颗高品质物理水滴，张力收敛、晶莹剔透)
    // ─────────────────────────────────────────────────────────────
    const glassDrops: GlassDrop[] = [];
    for (let i = 0; i < 32; i++) {
      const r = 2.0 + Math.random() * 3.6;
      glassDrops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: r,
        targetRadius: r,
        mass: r * 0.3,
        threshold: 3.8 + Math.random() * 2.8,
        vy: 0,
        isSliding: false,
        slidePauseTimer: 0,
        tail: []
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. 雨点轻击玻璃水花
    // ─────────────────────────────────────────────────────────────
    const splashes: SplashRing[] = [];
    let lastDropTime = 0;

    // 绘制高保真真实玻璃水滴 (椭圆重力接触角、透镜聚光折射与锋芒高光)
    const drawRealisticDrop = (x: number, y: number, r: number, alpha = 1) => {
      if (r <= 0.6) return;
      ctx.save();

      // (a) 下垂接触角微阴影 (真实水珠趴在玻璃上的重力下垂微阴影)
      ctx.beginPath();
      ctx.ellipse(x + r * 0.08, y + r * 0.16, r * 0.95, r * 1.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 10, 25, ${0.45 * alpha})`;
      ctx.fill();

      // (b) 水滴本体透镜 (微蓝透亮质感)
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.96, r * 1.04, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(186, 230, 253, ${0.25 * alpha})`;
      ctx.fill();

      // (c) 边缘表面张力弯月暗圈 (Dark Meniscus Rim)
      ctx.lineWidth = Math.max(0.6, r * 0.14);
      ctx.strokeStyle = `rgba(12, 30, 54, ${0.65 * alpha})`;
      ctx.stroke();

      // (d) 底部透镜聚光反光弧 (Bottom Caustic Glow)
      ctx.beginPath();
      ctx.arc(x, y + r * 0.32, r * 0.65, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = `rgba(224, 242, 254, ${0.65 * alpha})`;
      ctx.lineWidth = Math.max(0.7, r * 0.22);
      ctx.stroke();

      // (e) 顶部真实锐利星芒高光点 (Pinpoint Specular Highlight)
      ctx.beginPath();
      ctx.arc(x - r * 0.32, y - r * 0.32, Math.max(0.7, r * 0.26), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.98 * alpha})`;
      ctx.fill();

      // (f) 极小次高光微点
      if (r > 3.5) {
        ctx.beginPath();
        ctx.arc(x + r * 0.25, y + r * 0.28, r * 0.14, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * alpha})`;
        ctx.fill();
      }

      ctx.restore();
    };

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // ─────────────────────────────────────────────────────────────
      // (1) 绘制窗外飞速飘落的极细倾斜雨丝 (Rain Streaks - 仅微弱景深，不干扰文字)
      // ─────────────────────────────────────────────────────────────
      if (playing) {
        ctx.save();
        const rainAngle = 0.22; // 约 13 度倾角
        const dx = Math.sin(rainAngle);
        const dy = Math.cos(rainAngle);

        for (const s of streaks) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - dx * s.len, s.y + dy * s.len);
          ctx.strokeStyle = `rgba(186, 230, 253, ${s.alpha})`;
          ctx.lineWidth = s.thickness;
          ctx.lineCap = 'round';
          ctx.stroke();

          // 物理步进
          s.x -= dx * s.speed;
          s.y += dy * s.speed;

          if (s.y > height + 50 || s.x < -100) {
            s.y = -50;
            s.x = Math.random() * (width + 200);
          }
        }
        ctx.restore();
      }

      // ─────────────────────────────────────────────────────────────
      // (2) 绘制玻璃表面的微小水汽凝露 (Micro Dew - 极度柔和通透)
      // ─────────────────────────────────────────────────────────────
      ctx.save();
      for (const dew of microDews) {
        ctx.beginPath();
        ctx.arc(dew.x, dew.y, dew.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 242, 254, ${dew.alpha})`;
        ctx.fill();
      }
      ctx.restore();

      // ─────────────────────────────────────────────────────────────
      // (3) 雨滴轻柔撞击玻璃微涟漪 (低频偶发，如同轻细雨敲窗，绝不造成满屏噪点)
      // ─────────────────────────────────────────────────────────────
      if (playing && time - lastDropTime > (420 + Math.random() * 550)) {
        lastDropTime = time;
        const hitX = Math.random() * width;
        const hitY = Math.random() * height;

        // 激起 2~3 颗细微飞溅微点
        const particles = [];
        for (let p = 0; p < 2; p++) {
          const pAngle = Math.random() * Math.PI * 2;
          const pSpd = 0.8 + Math.random() * 1.6;
          particles.push({
            x: hitX,
            y: hitY,
            vx: Math.cos(pAngle) * pSpd,
            vy: Math.sin(pAngle) * pSpd - 0.4,
            alpha: 0.6
          });
        }

        splashes.push({
          x: hitX,
          y: hitY,
          r: 1.2,
          maxR: 6 + Math.random() * 8,
          alpha: 0.6,
          particles
        });

        // 雨滴打在玻璃上：如果附近有已有水滴则融合变大，否则凝成新水珠
        let merged = false;
        for (const drop of glassDrops) {
          const dx = drop.x - hitX;
          const dy = drop.y - hitY;
          if (Math.hypot(dx, dy) < drop.radius + 12) {
            drop.targetRadius = Math.min(8, drop.targetRadius + 0.8);
            drop.mass += 0.5;
            merged = true;
            break;
          }
        }
        if (!merged && glassDrops.length < 36) {
          glassDrops.push({
            x: hitX,
            y: hitY,
            radius: 1.5,
            targetRadius: 1.8 + Math.random() * 2.2,
            mass: 0.5,
            threshold: 4.0 + Math.random() * 2.0,
            vy: 0,
            isSliding: false,
            slidePauseTimer: 0,
            tail: []
          });
        }
      }

      // 渲染飞溅涟漪与飞溅小水珠
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        ctx.save();
        // 涟漪水圈
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(186, 230, 253, ${s.alpha * 0.75})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 飞溅微水珠
        for (const p of s.particles) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 0.9, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12; // 微小重力
          p.alpha *= 0.88;
        }
        ctx.restore();

        s.r += 0.85;
        s.alpha *= 0.89;
        if (s.alpha <= 0.02 || s.r >= s.maxR) {
          splashes.splice(i, 1);
        }
      }

      // ─────────────────────────────────────────────────────────────
      // (5) 玻璃表面水滴物理：张力凝结、融合吸收与真实的停顿撕裂滑落 (Staccato Trickle)
      // ─────────────────────────────────────────────────────────────
      for (let i = glassDrops.length - 1; i >= 0; i--) {
        const d = glassDrops[i];

        // 弹性尺寸过渡
        d.radius += (d.targetRadius - d.radius) * 0.18;

        if (!d.isSliding) {
          // 静止附着状态：随着降雨缓慢蓄积质量
          if (playing) d.mass += 0.0035;

          // 蓄水突破阈值 -> 打破静摩擦力，启动重力撕裂滑落！
          if (d.mass >= d.threshold) {
            d.isSliding = true;
            d.vy = 2.4;
            d.slidePauseTimer = 12 + Math.floor(Math.random() * 16);
          }
        } else {
          // 滑落状态：真实的走走停停 (滑一段 -> 微暂停吸收沿途水珠 -> 再突然加速)
          if (d.slidePauseTimer > 0) {
            d.slidePauseTimer--;
            d.vy += 0.42;
            d.y += d.vy;

            // 记录撕裂水痕 (控制在短促自然的湿润水路内，避免突兀长线)
            d.tail.push({ x: d.x, y: d.y, r: d.radius * 0.45, alpha: 0.3 });
            if (d.tail.length > 12) d.tail.shift();

            // 吞噬沿途小雨滴
            for (let j = glassDrops.length - 1; j >= 0; j--) {
              if (i === j) continue;
              const other = glassDrops[j];
              if (!other.isSliding) {
                const dist = Math.hypot(other.x - d.x, other.y - d.y);
                if (dist < d.radius + other.radius + 2) {
                  d.targetRadius = Math.min(16, d.targetRadius + other.radius * 0.32);
                  d.vy += 0.28;
                  glassDrops.splice(j, 1);
                  if (j < i) i--;
                }
              }
            }
          } else {
            // 停顿蓄势阶段 (Staccato Trickle Pause)
            d.vy *= 0.5;
            d.y += d.vy;
            if (Math.random() < 0.18) {
              // 蓄足能量重新加速冲刺
              d.slidePauseTimer = 10 + Math.floor(Math.random() * 14);
              d.vy = 2.0;
            }
          }

          // 绘制撕裂水痕轨迹 (柔和通透的水迹微光，绝不使用刺眼垂直纯白长线)
          if (d.tail.length > 2) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(d.tail[0].x, d.tail[0].y);
            for (let k = 1; k < d.tail.length; k++) {
              ctx.lineTo(d.tail[k].x, d.tail[k].y);
            }
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.20)';
            ctx.lineWidth = Math.max(0.8, d.radius * 0.3);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.restore();
          }

          // 滑出屏幕底端 -> 循环重置至顶部
          if (d.y > height + 40) {
            d.y = -10;
            d.x = Math.random() * width;
            d.vy = 0;
            d.mass = 0.5;
            d.radius = 2.0;
            d.targetRadius = 2.2 + Math.random() * 2.8;
            d.isSliding = false;
            d.slidePauseTimer = 0;
            d.tail = [];
          }
        }

        // 绘制玻璃水滴
        drawRealisticDrop(d.x, d.y, d.radius);
      }

      if (isVisible) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });
</script>

<canvas
  bind:this={canvasEl}
  data-testid="rain-particle-canvas"
  class="absolute inset-0 w-full h-full pointer-events-none z-0"
></canvas>
