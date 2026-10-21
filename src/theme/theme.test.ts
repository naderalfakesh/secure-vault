import { darkColors, lightColors } from './colors';
import { controlSize, motion, radii, spacing, touchTarget } from './tokens';
import { darkTheme, lightTheme } from './unistyles';
import { typography } from './typography';

describe('theme', () => {
  it('defines every light color in the dark palette too', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('uses the handover palette in both modes', () => {
    expect(lightColors.primary).toBe('#3451D1');
    expect(darkColors.primary).toBe('#8EA2FF');
    expect(lightColors.accent).toBe(lightColors.warning);
    expect(darkColors.accent).toBe(darkColors.warning);
    // Text on a danger fill stays dark in dark mode.
    expect(darkColors.onDanger).toBe('#2A0710');
    // The viewer stage and the toasts look the same in both modes.
    expect(darkColors.viewerStage).toBe(lightColors.viewerStage);
    expect(darkColors.toastBg).toBe(lightColors.toastBg);
  });

  it('shares spacing, radii, and type scale between themes', () => {
    expect(darkTheme.spacing).toBe(lightTheme.spacing);
    expect(darkTheme.radii).toBe(lightTheme.radii);
    expect(darkTheme.typography).toBe(lightTheme.typography);
  });

  it('keeps line heights readable for every variant', () => {
    for (const style of Object.values(typography)) {
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
    }
  });

  it('follows the handover type, spacing, radii, and target sizes', () => {
    expect(typography.label).toMatchObject({ fontSize: 13, lineHeight: 18, letterSpacing: 0.4 });
    expect(typography.pinDigit.fontVariant).toEqual(['tabular-nums']);
    expect(spacing.xxxl).toBe(56);
    expect(radii).toMatchObject({ card: 20, group: 20, input: 14, sheet: 36, toast: 18 });
    expect(touchTarget).toBe(44);
    expect(controlSize).toMatchObject({ buttonLarge: 52, buttonMedium: 44, pinKey: 76 });
    expect(motion.toastMs).toBe(4000);
    expect(motion.toastWithActionMs).toBe(8000);
  });
});
