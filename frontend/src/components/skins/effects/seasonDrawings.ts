import type { SunflowerPlant } from './seasonTypes';

/**
 * 🌸 1. 绘制真实吉野樱花瓣 (实景照片级：白里透微粉 + 花心绯红微晕 + 浅柔微缺口)
 */
export function drawRealisticSakura(
  c: CanvasRenderingContext2D,
  size: number,
  color: string,
  subColor: string,
  alpha: number
) {
  c.save();
  c.globalAlpha = alpha;
  // 渐变原点设在花瓣基部 (靠近花萼花心处)
  const grad = c.createRadialGradient(0, size * 0.65, 0, 0, -size * 0.1, size * 1.35);
  grad.addColorStop(0, '#e11d48');     // 花心连接处一小撮娇艳山樱绯红
  grad.addColorStop(0.18, '#f472b6');  // 自然晕开的樱粉
  grad.addColorStop(0.42, '#fce7f3');  // 透亮浅粉
  grad.addColorStop(0.72, color);      // 瓣身白透微粉
  grad.addColorStop(1, '#ffffff');     // 瓣尖纯净透白
  c.fillStyle = grad;

  // 优雅倒卵形天然花瓣轮廓 (顶端带轻柔浅凹，告别夸张大V缺口与塑料感)
  c.beginPath();
  c.moveTo(0, size * 0.75);
  // 左侧优美弧线
  c.bezierCurveTo(-size * 0.25, size * 0.65, -size * 0.45, size * 0.22, -size * 0.42, -size * 0.35);
  // 左上瓣圆润过渡到顶部
  c.bezierCurveTo(-size * 0.4, -size * 0.65, -size * 0.24, -size * 0.78, -size * 0.08, -size * 0.8);
  // 顶部极其轻微柔和的自然小浅凹
  c.quadraticCurveTo(0, -size * 0.72, size * 0.08, -size * 0.8);
  // 右上瓣圆润过渡
  c.bezierCurveTo(size * 0.24, -size * 0.78, size * 0.4, -size * 0.65, size * 0.42, -size * 0.35);
  // 右侧弧线回归基部
  c.bezierCurveTo(size * 0.45, size * 0.22, size * 0.25, size * 0.65, 0, size * 0.75);
  c.closePath();
  c.fill();

  // 半透明纯白光边缘勾勒 (实景写真透光感)
  c.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  c.lineWidth = 0.65;
  c.stroke();
  c.restore();
}

/**
 * 🍂 2. 绘制高度自然逼真的金秋落叶 (纯正金黄银杏扇叶 + 纯正深秋红枫叶)
 */
export function drawGoldenLeaf(
  c: CanvasRenderingContext2D,
  size: number,
  color: string,
  type: number,
  alpha: number,
  flipVal: number = 1
) {
  c.save();
  c.globalAlpha = alpha;
  const isBackside = flipVal < 0;

  if (type === 0) {
    // 🍂 真实天然银杏叶 (Ginkgo Biloba 扇形叶带微波浪与金黄叶脉)
    // 1. 纤细弧形叶柄
    c.beginPath();
    c.moveTo(0, size * 0.95);
    c.quadraticCurveTo(size * 0.12, size * 0.55, 0, size * 0.22);
    c.strokeStyle = isBackside ? '#ca8a04' : '#b45309';
    c.lineWidth = 1.1;
    c.lineCap = 'round';
    c.stroke();

    // 2. 优美扇形叶片 (带自然波浪叶缘与中央浅凹口)
    c.beginPath();
    c.moveTo(0, size * 0.22);
    // 右侧柔和展开展面
    c.bezierCurveTo(size * 0.45, size * 0.18, size * 0.9, -size * 0.15, size * 0.85, -size * 0.55);
    // 右上半段微波浪
    c.quadraticCurveTo(size * 0.6, -size * 0.72, size * 0.25, -size * 0.82);
    // 中央自然下凹小裂缝
    c.quadraticCurveTo(0, -size * 0.62, -size * 0.25, -size * 0.82);
    // 左上半段微波浪
    c.quadraticCurveTo(-size * 0.6, -size * 0.72, -size * 0.85, -size * 0.55);
    // 左侧回归叶柄基部
    c.bezierCurveTo(-size * 0.9, -size * 0.15, -size * 0.45, size * 0.18, 0, size * 0.22);
    c.closePath();

    // 正反面渐变着色 (正面璀璨金黄，背面柔淡麦金)
    const grad = c.createRadialGradient(0, -size * 0.25, 0, 0, -size * 0.25, size * 0.85);
    if (isBackside) {
      grad.addColorStop(0, '#fef9c3'); // 背面更淡
      grad.addColorStop(0.6, '#fef08a');
      grad.addColorStop(1, '#eab308');
    } else {
      grad.addColorStop(0, '#fef08a'); // 正面亮阳纯金
      grad.addColorStop(0.5, '#facc15');
      grad.addColorStop(1, color);
    }
    c.fillStyle = grad;
    c.fill();

    // 3. 细腻金黄放射状银杏叶脉 (穿透光影感)
    c.save();
    c.strokeStyle = isBackside ? 'rgba(234, 179, 8, 0.22)' : 'rgba(254, 240, 138, 0.45)';
    c.lineWidth = 0.6;
    const veinAngles = [-0.65, -0.4, -0.15, 0.15, 0.4, 0.65];
    for (const va of veinAngles) {
      c.beginPath();
      c.moveTo(0, size * 0.22);
      const destX = Math.sin(va) * (size * 0.78);
      const destY = -Math.cos(va) * (size * 0.78);
      c.quadraticCurveTo(destX * 0.5 + va * 2, destY * 0.5, destX, destY);
      c.stroke();
    }
    c.restore();

    // 柔和微光边缘勾勒
    c.strokeStyle = isBackside ? 'rgba(234, 179, 8, 0.35)' : 'rgba(255, 255, 255, 0.5)';
    c.lineWidth = 0.5;
    c.stroke();
  } else {
    // 🍁 真实自然五裂掌状红枫叶 (Acer palmatum 鸡爪红枫：纯正鲜艳红枫，圆润优雅轮廓，绝非生硬多角星)
    // 1. 细长深红/酒红枫叶叶柄
    c.beginPath();
    c.moveTo(0, size * 0.95);
    c.quadraticCurveTo(size * 0.08, size * 0.58, 0, size * 0.28);
    c.strokeStyle = '#7f1d1d';
    c.lineWidth = 1.1;
    c.lineCap = 'round';
    c.stroke();

    // 2. 优美掌状五裂自然外轮廓 (柔美弧线过渡与深裂凹口，尖挺舒展)
    c.beginPath();
    c.moveTo(0, size * 0.28);
    // 右下副裂片
    c.bezierCurveTo(size * 0.2, size * 0.28, size * 0.45, size * 0.32, size * 0.64, size * 0.22);
    c.bezierCurveTo(size * 0.48, size * 0.12, size * 0.38, 0.02, size * 0.28, 0);
    // 右上主裂片
    c.bezierCurveTo(size * 0.45, -size * 0.14, size * 0.68, -size * 0.32, size * 0.78, -size * 0.44);
    c.bezierCurveTo(size * 0.52, -size * 0.4, size * 0.36, -size * 0.38, size * 0.22, -size * 0.36);
    // 顶部中央主裂片
    c.bezierCurveTo(size * 0.2, -size * 0.58, size * 0.14, -size * 0.82, 0, -size * 0.94);
    // 左半边优雅对称
    c.bezierCurveTo(-size * 0.14, -size * 0.82, -size * 0.2, -size * 0.58, -size * 0.22, -size * 0.36);
    c.bezierCurveTo(-size * 0.36, -size * 0.38, -size * 0.52, -size * 0.4, -size * 0.78, -size * 0.44);
    c.bezierCurveTo(-size * 0.68, -size * 0.32, -size * 0.45, -size * 0.14, -size * 0.28, 0);
    c.bezierCurveTo(-size * 0.38, 0.02, -size * 0.48, size * 0.12, -size * 0.64, size * 0.22);
    c.bezierCurveTo(-size * 0.45, size * 0.32, -size * 0.2, size * 0.28, 0, size * 0.28);
    c.closePath();

    // 纯正鲜红枫叶渐变 (珊瑚红透光叶心 -> 纯正鲜红 -> 浓郁酒红)
    const grad = c.createRadialGradient(0, -size * 0.15, 0, 0, 0, size * 0.95);
    if (isBackside) {
      grad.addColorStop(0, '#fca5a5');
      grad.addColorStop(0.5, '#f87171');
      grad.addColorStop(1, '#dc2626');
    } else {
      grad.addColorStop(0, '#f87171');  // 透光明媚珊瑚红
      grad.addColorStop(0.35, '#ef4444'); // 纯正鲜红
      grad.addColorStop(0.7, '#dc2626');  // 深秋枫红
      grad.addColorStop(1, '#991b1b');    // 尖端浓郁秋红
    }
    c.fillStyle = grad;
    c.fill();

    // 3. 掌状五裂主脉与侧脉 (半透明浅珊瑚白叶脉)
    c.save();
    c.strokeStyle = isBackside ? 'rgba(254, 202, 202, 0.45)' : 'rgba(254, 226, 226, 0.65)';
    c.lineWidth = 0.7;
    c.beginPath();
    // 顶部中脉
    c.moveTo(0, size * 0.28);
    c.lineTo(0, -size * 0.88);
    // 右上主脉
    c.moveTo(0, size * 0.28);
    c.quadraticCurveTo(size * 0.32, -0.05, size * 0.72, -size * 0.4);
    // 右下副脉
    c.moveTo(0, size * 0.28);
    c.lineTo(size * 0.58, size * 0.2);
    // 左上主脉
    c.moveTo(0, size * 0.28);
    c.quadraticCurveTo(-size * 0.32, -0.05, -size * 0.72, -size * 0.4);
    // 左下副脉
    c.moveTo(0, size * 0.28);
    c.lineTo(-size * 0.58, size * 0.2);
    c.stroke();
    c.restore();

    // 柔和微光勾勒
    c.strokeStyle = isBackside ? 'rgba(254, 202, 202, 0.35)' : 'rgba(255, 255, 255, 0.4)';
    c.lineWidth = 0.5;
    c.stroke();
  }
  c.restore();
}

/**
 * 🌻 3. 绘制真实小巧自然的向日葵植株 (秀气花茎、小阔叶、双层迷你金黄花瓣、精致花蕊盘)
 */
export function drawRealisticSunflowerPlant(
  c: CanvasRenderingContext2D,
  plant: SunflowerPlant,
  groundY: number,
  sway: number,
  width: number
) {
  const rootX = plant.xPercent * width;
  const headX = rootX + sway;
  const headY = groundY - plant.heightPx;

  c.save();

  // A. 细巧自然的嫩绿花茎
  c.beginPath();
  c.moveTo(rootX, groundY);
  c.quadraticCurveTo(rootX + sway * 0.35, groundY - plant.heightPx * 0.55, headX, headY);
  c.strokeStyle = '#15803d';
  c.lineWidth = 2.2;
  c.lineCap = 'round';
  c.stroke();

  // 茎部高光细线
  c.beginPath();
  c.moveTo(rootX + 0.6, groundY);
  c.quadraticCurveTo(rootX + sway * 0.35 + 0.6, groundY - plant.heightPx * 0.55, headX + 0.5, headY);
  c.strokeStyle = '#4ade80';
  c.lineWidth = 0.8;
  c.stroke();

  // B. 侧生小巧向日葵叶片 (两片小阔叶，带细脉)
  const leaves = [
    { yRatio: 0.35, side: plant.leafSide, len: 13, wid: 7 },
    { yRatio: 0.65, side: -plant.leafSide, len: 10, wid: 5 }
  ];

  for (const lf of leaves) {
    const lfRootY = groundY - plant.heightPx * lf.yRatio;
    const lfRootX = rootX + sway * lf.yRatio;

    c.save();
    c.translate(lfRootX, lfRootY);
    c.scale(lf.side, 1);
    c.rotate(-0.25);

    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(lf.len * 0.3, -lf.wid * 0.8, lf.len * 0.8, -lf.wid * 0.5, lf.len, 0);
    c.bezierCurveTo(lf.len * 0.7, lf.wid * 0.8, lf.len * 0.3, lf.wid * 0.5, 0, 0);
    c.fillStyle = '#16a34a';
    c.fill();

    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(lf.len * 0.5, 0, lf.len * 0.85, 0);
    c.strokeStyle = '#86efac';
    c.lineWidth = 0.7;
    c.stroke();

    c.restore();
  }

  // C. 秀气精致向日葵花盘
  c.save();
  c.translate(headX, headY);

  // (1) 外层金黄花瓣 (16片迷你披针形)
  const petals = plant.petalCount;
  const outerLen = plant.headSize * 0.75;
  const outerWid = plant.headSize * 0.28;
  for (let i = 0; i < petals; i++) {
    const rad = (Math.PI * 2 / petals) * i;
    c.save();
    c.rotate(rad);
    c.beginPath();
    c.moveTo(0, plant.headSize * 0.42);
    c.bezierCurveTo(-outerWid, plant.headSize * 0.75, -outerWid * 0.5, plant.headSize * 0.42 + outerLen, 0, plant.headSize * 0.42 + outerLen + 1.5);
    c.bezierCurveTo(outerWid * 0.5, plant.headSize * 0.42 + outerLen, outerWid, plant.headSize * 0.75, 0, plant.headSize * 0.42);
    c.fillStyle = i % 2 === 0 ? '#facc15' : '#fde047';
    c.fill();
    c.restore();
  }

  // (2) 内层迷你金黄花瓣
  const innerLen = plant.headSize * 0.5;
  const innerWid = plant.headSize * 0.22;
  for (let i = 0; i < petals; i++) {
    const rad = (Math.PI * 2 / petals) * (i + 0.5);
    c.save();
    c.rotate(rad);
    c.beginPath();
    c.moveTo(0, plant.headSize * 0.45);
    c.bezierCurveTo(-innerWid, plant.headSize * 0.7, 0, plant.headSize * 0.45 + innerLen, 0, plant.headSize * 0.45 + innerLen);
    c.bezierCurveTo(0, plant.headSize * 0.45 + innerLen, innerWid, plant.headSize * 0.7, 0, plant.headSize * 0.45);
    c.fillStyle = '#eab308';
    c.fill();
    c.restore();
  }

  // (3) 迷你花蕊盘
  c.beginPath();
  c.arc(0, 0, plant.headSize * 0.48, 0, Math.PI * 2);
  c.fillStyle = '#3f1d0b';
  c.fill();

  c.beginPath();
  c.arc(0, 0, plant.headSize * 0.36, 0, Math.PI * 2);
  c.fillStyle = '#78350f';
  c.fill();

  // 葵花籽微细金点
  c.fillStyle = '#fde047';
  const ringDots = 8;
  for (let d = 0; d < ringDots; d++) {
    const dRad = (Math.PI * 2 / ringDots) * d;
    const dX = Math.cos(dRad) * (plant.headSize * 0.26);
    const dY = Math.sin(dRad) * (plant.headSize * 0.26);
    c.beginPath();
    c.arc(dX, dY, 0.8, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
  c.restore();
}

/**
 * 🌿 4. 绘制秀美低矮的夏日草地与小雏菊 (高度控制在底部 12~20px，绝不遮挡文字)
 */
export function drawGrassAndWildflowers(c: CanvasRenderingContext2D, groundY: number, sway: number, width: number) {
  c.save();
  const step = 10;
  for (let x = 0; x < width; x += step) {
    const bladeHeight = 12 + (Math.sin(x * 0.08) * 6 + Math.cos(x * 0.16) * 4);
    const bladeSway = Math.sin(x * 0.1 + sway * 0.4) * 3;

    c.beginPath();
    c.moveTo(x, groundY);
    c.quadraticCurveTo(x + bladeSway * 0.5, groundY - bladeHeight * 0.6, x + bladeSway + 1.5, groundY - bladeHeight);
    c.quadraticCurveTo(x + bladeSway * 0.35, groundY - bladeHeight * 0.35, x + 3, groundY);
    c.fillStyle = (x % 20 === 0) ? '#15803d' : (x % 30 === 0) ? '#4ade80' : '#16a34a';
    c.globalAlpha = 0.55;
    c.fill();

    // 偶有点缀微型天蓝小野花与白雏菊
    if (x % 40 === 0) {
      c.save();
      c.translate(x + bladeSway, groundY - bladeHeight * 0.8);
      c.fillStyle = (x % 80 === 0) ? '#38bdf8' : '#ffffff';
      c.globalAlpha = 0.8;
      for (let p = 0; p < 5; p++) {
        c.beginPath();
        c.arc(Math.cos(p * Math.PI * 0.4) * 2, Math.sin(p * Math.PI * 0.4) * 2, 1.1, 0, Math.PI * 2);
        c.fill();
      }
      c.beginPath();
      c.arc(0, 0, 0.8, 0, Math.PI * 2);
      c.fillStyle = '#facc15';
      c.fill();
      c.restore();
    }
  }
  c.restore();
}

/**
 * ❄️ 5. 绘制纯白精致六角冰晶雪花
 */
export function drawSnowflake(c: CanvasRenderingContext2D, size: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(-size, 0);
    c.lineTo(size, 0);
    c.moveTo(-size * 0.6, -size * 0.32);
    c.lineTo(-size * 0.3, 0);
    c.lineTo(-size * 0.6, size * 0.32);
    c.moveTo(size * 0.6, -size * 0.32);
    c.lineTo(size * 0.3, 0);
    c.lineTo(size * 0.6, size * 0.32);
    c.stroke();
    c.rotate(Math.PI / 3);
  }
}
