export function progressPercent(progress: number): number {
  return Math.round(Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * 100);
}
