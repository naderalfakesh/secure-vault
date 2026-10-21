import { darkColors, lightColors } from './colors';
import { controlSize, motion, radii, spacing, touchTarget } from './tokens';
import { darkTheme, lightTheme } from './unistyles';
import { typography } from './typography';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('theme', () => {
  it('keeps brass and success text AA on their muted chips (owner decision)', () => {
    // Light mode deviates from handover §3.1 to clear 4.5:1 on the chips.
    expect(lightColors.accent).toBe('#8F5E07');
    expect(lightColors.success).toBe('#14774A');
    for (const colors of [lightColors, darkColors]) {
      expect(contrast(colors.accent, colors.accentMuted)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.success, colors.successMuted)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.accent, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.success, colors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

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
