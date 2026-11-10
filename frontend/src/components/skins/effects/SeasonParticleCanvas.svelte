<script lang="ts">
  import type { SkinId } from '../skinTypes';
  import {
    sakuraTints,
    goldColors,
    mapleRedColors,
    DEFAULT_SUNFLOWERS,
    type LandedSnowCrystal
  } from './seasonTypes';
  import {
    drawRealisticSakura,
    drawGoldenLeaf,
    drawRealisticSunflowerPlant,
    drawGrassAndWildflowers,
    drawSnowflake
  } from './seasonDrawings';
  import { initSeasonParticles } from './seasonInit';

  let {
    skinId,
    playing = false,
    bottomOffset = 0,
    interactive = true
  } = $props<{
    skinId: SkinId;
    playing: boolean;
    bottomOffset?: number;
    interactive?: boolean;
  }>();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let animId = 0;

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

    let currentGroundY = height - (bottomOffset || 0);

    // 初始化粒子群
    const { airParticles, landedPetals, butterflies } = initSeasonParticles(
      skinId,
      width,
      height,
      currentGroundY
    );
    const landedSnowCrystals: LandedSnowCrystal[] = [];

    // 春秋地面积累上限适度控制（优雅不杂乱）
    const MAX_LANDED = skinId === 'sakura' ? 28 : 24;

    // ❄️ 冬季地表适度雪毯 (高度固定优雅 10~16px，绝不无限制生长遮挡内容)
    const snowCols = 36;
    const baseSnowDepths = new Array(snowCols).fill(12);
    for (let i = 0; i < snowCols; i++) {
      baseSnowDepths[i] = 12 + Math.sin(i * 0.5) * 4;
    }

    const getSnowSurfaceY = (x: number, groundY: number) => {
      const colWidth = width / (snowCols - 1);
      const col = Math.min(snowCols - 2, Math.max(0, Math.floor(x / colWidth)));
      const t = (x - col * colWidth) / colWidth;
      const h = baseSnowDepths[col] * (1 - t) + baseSnowDepths[col + 1] * t;
      return groundY - h;
    };

    const sunflowers = DEFAULT_SUNFLOWERS;
    let tick = 0;

    const render = () => {
      if (!isVisible) return;
      ctx.clearRect(0, 0, width, height);
      tick++;

      const speedMult = playing ? 1.0 : 0.45;
      const targetGroundY = height - (bottomOffset || 0);
      currentGroundY += (targetGroundY - currentGroundY) * 0.12;

      // ─────────────────────────────────────────────────────────────
      // 1. 🌸 樱花：写真级初樱粉白 + 花心娇红微晕 + 适量地面落花毯
      // ─────────────────────────────────────────────────────────────
      if (skinId === 'sakura') {
        for (let i = landedPetals.length - 1; i >= 0; i--) {
          const lp = landedPetals[i];
          const drawY = currentGroundY + lp.relY;
          ctx.save();
          ctx.translate(lp.x, drawY);
          ctx.rotate(lp.angle);
          ctx.scale(1, Math.cos(lp.flip) * 0.4 + 0.6);
          drawRealisticSakura(ctx, lp.size, lp.color, '#e11d48', lp.alpha);
          ctx.restore();

          if (landedPetals.length > MAX_LANDED) {
            lp.alpha -= 0.0022;
            if (lp.alpha <= 0) landedPetals.splice(i, 1);
          }
        }

        for (const p of airParticles) {
          p.oscillation += p.oscSpeed * speedMult;
          const windSway = Math.sin(p.oscillation) * 1.0;
          p.x += (p.vx + windSway) * speedMult;
          p.y += p.vy * speedMult;
          p.angle += p.vAngle * speedMult;
          p.flip += p.vFlip * speedMult;

          if (p.y >= currentGroundY - 4 - Math.random() * 16) {
            if (landedPetals.length < MAX_LANDED + 6 && Math.random() < 0.7) {
              landedPetals.push({
                x: p.x,
                relY: -4 - Math.random() * 18,
                size: p.size,
                angle: p.angle,
                flip: (Math.random() - 0.5) * 0.8,
                color: p.color,
                alpha: p.alpha,
                maxAlpha: p.alpha
              });
            }
            p.y = -20 - Math.random() * 25;
            p.x = Math.random() * (width + 80) - 40;
            p.color = sakuraTints[Math.floor(Math.random() * sakuraTints.length)];
          }

          if (p.x > width + 25) p.x = -25;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.scale(Math.cos(p.flip), 1);
          drawRealisticSakura(ctx, p.size, p.color, p.subColor, p.alpha);
          ctx.restore();
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 2. 🌻 盛夏：晴空蔚蓝萤光 + 逼真小巧向日葵与草丛 + 优雅慢飞蝶
      // ─────────────────────────────────────────────────────────────
      else if (skinId === 'summer') {
        for (const p of airParticles) {
          p.oscillation += p.oscSpeed * speedMult;
          p.y += p.vy * speedMult;
          p.x += Math.sin(p.oscillation) * 0.35 * speedMult;
          p.flip += p.vFlip;

          if (p.y < -20) {
            p.y = currentGroundY + 15;
            p.x = Math.random() * width;
          }

          const currentAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.flip));
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = currentAlpha;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.subColor;
          ctx.fill();
          ctx.restore();
        }

        const windCycle = Math.sin(tick * 0.015) * 4;
        drawGrassAndWildflowers(ctx, currentGroundY, windCycle, width);
        for (const sf of sunflowers) {
          drawRealisticSunflowerPlant(ctx, sf, currentGroundY, Math.sin(tick * 0.015 + sf.swayPhase) * 5, width);
        }

        for (const b of butterflies) {
          if (b.isResting) {
            b.restTimer--;
            b.wingAngle += 0.025;
            const sf = sunflowers[b.restTargetIndex];
            if (sf) {
              const rootX = sf.xPercent * width;
              const sway = Math.sin(tick * 0.015 + sf.swayPhase) * 4;
              b.x = rootX + sway;
              b.y = currentGroundY - sf.heightPx - 3;
            }
            if (b.restTimer <= 0) {
              b.isResting = false;
              b.targetX = width * 0.15 + Math.random() * width * 0.7;
              b.targetY = height * 0.25 + Math.random() * (currentGroundY - height * 0.45);
            }
          } else {
            if (Math.hypot(b.targetX - b.x, b.targetY - b.y) < 25 || Math.random() < 0.005) {
              if (Math.random() < 0.45) {
                const chosenIdx = Math.floor(Math.random() * sunflowers.length);
                const chosenSf = sunflowers[chosenIdx];
                b.restTargetIndex = chosenIdx;
                b.targetX = chosenSf.xPercent * width;
                b.targetY = currentGroundY - chosenSf.heightPx - 3;
                b.isResting = true;
                b.restTimer = 350 + Math.floor(Math.random() * 250);
              } else {
                b.targetX = width * 0.1 + Math.random() * width * 0.8;
                b.targetY = height * 0.2 + Math.random() * (currentGroundY - height * 0.4);
              }
            }
            const dx = b.targetX - b.x;
            const dy = b.targetY - b.y;
            const moveSpeed = playing ? 0.45 : 0.25;
            b.x += dx * 0.006 * moveSpeed;
            b.y += dy * 0.006 * moveSpeed;
            b.wingAngle += b.wingSpeed * (playing ? 0.8 : 0.5);
          }

          const wingSpread = Math.sin(b.wingAngle);
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.shadowBlur = 8;
          ctx.shadowColor = b.accentColor;
          ctx.fillStyle = b.color;
          ctx.globalAlpha = 0.92;

          // 左翅
          ctx.save();
          ctx.scale(wingSpread, 1);
          ctx.beginPath();
          ctx.ellipse(-b.size * 0.5, -b.size * 0.3, b.size * 0.65, b.size * 0.4, -0.4, 0, Math.PI * 2);
          ctx.ellipse(-b.size * 0.4, b.size * 0.4, b.size * 0.45, b.size * 0.3, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 右翅
          ctx.save();
          ctx.scale(-wingSpread, 1);
          ctx.beginPath();
          ctx.ellipse(-b.size * 0.5, -b.size * 0.3, b.size * 0.65, b.size * 0.4, -0.4, 0, Math.PI * 2);
          ctx.ellipse(-b.size * 0.4, b.size * 0.4, b.size * 0.45, b.size * 0.3, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 蝶身
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(0, 0, 1.8, b.size * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 3. 🍁 金秋：极缓轻柔金叶/红枫飘落 + 空中空气动力翻卷 + 唯美地毯
      // ─────────────────────────────────────────────────────────────
      else if (skinId === 'autumn') {
        for (let i = landedPetals.length - 1; i >= 0; i--) {
          const lp = landedPetals[i];
          const drawY = currentGroundY + lp.relY;
          const flipVal = Math.cos(lp.flip) * 0.4 + 0.6;
          ctx.save();
          ctx.translate(lp.x, drawY);
          ctx.rotate(lp.angle);
          ctx.scale(1, flipVal);
          drawGoldenLeaf(ctx, lp.size, lp.color, lp.type || 0, lp.alpha, flipVal);
          ctx.restore();

          if (landedPetals.length > MAX_LANDED) {
            lp.alpha -= 0.0022;
            if (lp.alpha <= 0) landedPetals.splice(i, 1);
          }
        }

        for (const p of airParticles) {
          p.oscillation += p.oscSpeed * speedMult;
          const sway = Math.sin(p.oscillation) * 1.8;
          const airResistance = 0.65 + Math.abs(Math.sin(p.flip)) * 0.45;
          p.x += (p.vx + sway) * speedMult;
          p.y += (p.vy * airResistance) * speedMult;
          p.angle += p.vAngle * speedMult;
          p.flip += p.vFlip * speedMult;

          if (p.y >= currentGroundY - 4 - Math.random() * 18) {
            if (landedPetals.length < MAX_LANDED + 6 && Math.random() < 0.7) {
              landedPetals.push({
                x: p.x,
                relY: -4 - Math.random() * 20,
                size: p.size,
                angle: p.angle,
                flip: (Math.random() - 0.5) * 0.8,
                color: p.color,
                alpha: p.alpha,
                maxAlpha: p.alpha,
                type: p.type
              });
            }
            p.y = -25 - Math.random() * 25;
            p.x = Math.random() * (width + 80) - 40;
            p.type = Math.random() > 0.5 ? 0 : 1;
            p.color = p.type === 0
              ? goldColors[Math.floor(Math.random() * goldColors.length)]
              : mapleRedColors[Math.floor(Math.random() * mapleRedColors.length)];
            p.subColor = p.type === 0 ? '#ca8a04' : '#7f1d1d';
          }

          if (p.x > width + 30) p.x = -30;

          const currentFlip = Math.cos(p.flip);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.scale(currentFlip, 1);
          drawGoldenLeaf(ctx, p.size, p.color, p.type || 0, p.alpha, currentFlip);
          ctx.restore();
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 4. ❄️ 凛冬：秀美纯白雪毯 (高度固定不增加) + 落地雪花自然慢慢融化消失
      // ─────────────────────────────────────────────────────────────
      else if (skinId === 'winter') {
        ctx.save();
        const snowGrad = ctx.createLinearGradient(0, currentGroundY - 16, 0, currentGroundY + 10);
        snowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        snowGrad.addColorStop(0.5, 'rgba(248, 250, 252, 0.85)');
        snowGrad.addColorStop(1, 'rgba(226, 232, 240, 0.65)');

        ctx.fillStyle = snowGrad;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, currentGroundY - baseSnowDepths[0]);
        for (let col = 0; col < snowCols; col++) {
          const colX = (width / (snowCols - 1)) * col;
          ctx.lineTo(colX, currentGroundY - baseSnowDepths[col]);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(0, currentGroundY - baseSnowDepths[0]);
        for (let col = 1; col < snowCols; col++) {
          const colX = (width / (snowCols - 1)) * col;
          ctx.lineTo(colX, currentGroundY - baseSnowDepths[col]);
        }
        ctx.stroke();
        ctx.restore();

        for (let i = landedSnowCrystals.length - 1; i >= 0; i--) {
          const sc = landedSnowCrystals[i];
          const surfaceAtX = getSnowSurfaceY(sc.x, currentGroundY);
          ctx.save();
          ctx.translate(sc.x, surfaceAtX - sc.relY);
          ctx.globalAlpha = sc.alpha;
          if (sc.type === 1) {
            ctx.rotate(sc.angle);
            drawSnowflake(ctx, sc.size * 0.65, '#ffffff');
          } else {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, sc.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          sc.alpha -= 0.015;
          if (sc.alpha <= 0) {
            landedSnowCrystals.splice(i, 1);
          }
        }

        for (const p of airParticles) {
          p.oscillation += p.oscSpeed * speedMult;
          p.x += (p.vx + Math.sin(p.oscillation) * 0.7) * speedMult;
          p.y += p.vy * speedMult;
          p.angle += p.vAngle * speedMult;

          const surfaceY = getSnowSurfaceY(p.x, currentGroundY);

          if (p.y >= surfaceY) {
            if (landedSnowCrystals.length < 28 && Math.random() < 0.75) {
              landedSnowCrystals.push({
                x: p.x,
                relY: 1,
                size: p.size,
                type: p.type || 0,
                alpha: 0.95,
                angle: p.angle
              });
            }

            p.y = -15 - Math.random() * 20;
            p.x = Math.random() * width;
          }

          if (p.x > width + 15) p.x = -15;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;

          if (p.type === 1) {
            ctx.rotate(p.angle);
            drawSnowflake(ctx, p.size, p.color);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(render);
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
  class="absolute inset-0 pointer-events-none z-0 w-full h-full"
  aria-hidden="true"
></canvas>
