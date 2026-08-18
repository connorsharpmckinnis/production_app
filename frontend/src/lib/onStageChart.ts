const BAR_HUES = [20, 45, 70, 145, 175, 210, 250, 280, 310, 340, 120, 195];

export function onStageBarColor(rowIndex: number): string {
  const hue = BAR_HUES[rowIndex % BAR_HUES.length];
  return `oklch(0.62 0.13 ${hue})`;
}

export function spinePercent(index: number, momentCount: number): number {
  if (momentCount <= 0) return 0;
  return (index / momentCount) * 100;
}

export function intervalWidthPercent(
  startIndex: number,
  endIndex: number,
  momentCount: number,
): number {
  if (momentCount <= 0) return 0;
  const span = Math.max(endIndex - startIndex, 1);
  return (span / momentCount) * 100;
}

export function chartMinWidthPx(momentCount: number): number {
  return Math.max(640, momentCount * 3);
}
