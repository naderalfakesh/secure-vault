import { darkColors, lightColors } from './colors';
import { darkTheme, lightTheme } from './unistyles';
import { typography } from './typography';

describe('theme', () => {
  it('defines every light color in the dark palette too', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
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
});
