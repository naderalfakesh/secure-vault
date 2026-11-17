/** Whole percent for a 0 to 1 progress; out-of-range and non-finite values clamp. */
export function progressPercent(progress: number): number {
  return Math.round(Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * 100);
}
