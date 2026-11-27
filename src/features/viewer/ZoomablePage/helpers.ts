export function clampToBounds(value: number, size: number, currentScale: number): number {
  'worklet';
  const bound = ((currentScale - 1) * size) / 2;
  return Math.min(Math.max(value, -bound), bound);
}

export function pinchTranslation(
  focal: number,
  size: number,
  savedTranslation: number,
  ratio: number,
): number {
  'worklet';
  const offset = focal - size / 2;
  return offset - (offset - savedTranslation) * ratio;
}

export function doubleTapTranslation(
  tapCoordinate: number,
  size: number,
  targetScale: number,
): number {
  'worklet';
  const offset = tapCoordinate - size / 2;
  return clampToBounds(offset * (1 - targetScale), size, targetScale) || 0;
}
