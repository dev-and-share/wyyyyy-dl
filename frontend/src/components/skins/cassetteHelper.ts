/**
 * 复古磁带双轴磁带卷半径计算（纯函数）
 * progress: 0 (歌曲开始，左满右空) -> 1 (歌曲结束，左空右满)
 */
export function calculateTapeRadii(progress: number, minR = 14, maxR = 36): { left: number; right: number } {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const span = maxR - minR;
  const left = Math.round((maxR - p * span) * 10) / 10;
  const right = Math.round((minR + p * span) * 10) / 10;
  return { left, right };
}
