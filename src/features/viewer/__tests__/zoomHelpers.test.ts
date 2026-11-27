import { clampToBounds, doubleTapTranslation, pinchTranslation } from '../ZoomablePage/helpers';

describe('ZoomablePage geometry helpers', () => {
  it('clamps translations to the scaled viewport bounds', () => {
    expect(clampToBounds(0, 400, 1)).toBe(0);
    expect(clampToBounds(50, 400, 1)).toBe(0);
    expect(clampToBounds(250, 400, 2)).toBe(200);
    expect(clampToBounds(-250, 400, 2)).toBe(-200);
    expect(clampToBounds(80, 400, 2)).toBe(80);
  });

  it('keeps the pinch focal point stationary while scaling', () => {
    // Pinching at screen center produces zero offset regardless of scale ratio.
    expect(pinchTranslation(200, 400, 0, 2)).toBe(0);
    // Pinching at the right edge (x = 400) shifts left by the newly exposed half-width.
    expect(pinchTranslation(400, 400, 0, 2)).toBe(-200);
  });

  it('centers a double-tap within the clamped zoom bounds', () => {
    expect(doubleTapTranslation(200, 400, 2.5)).toBe(0);
    // Tapping the far-right edge clamps to -((2.5 - 1) * 400) / 2 = -300.
    expect(doubleTapTranslation(400, 400, 2.5)).toBe(-300);
    expect(doubleTapTranslation(0, 400, 2.5)).toBe(300);
  });
});
