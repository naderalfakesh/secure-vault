import { act, render } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import * as AppearanceSetting from '@/theme/appearance';
import { darkColors, lightColors } from '@/theme/colors';

import { HANDOFF_FADE_MS, HANDOFF_FALLBACK_MS, SplashHandoff } from './SplashHandoff';

const hidden = { includeHiddenElements: true };

describe('SplashHandoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('repaints the splash mark until the native splash hides', async () => {
    const view = await render(<SplashHandoff released={false} />);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(view.getByTestId('splash-handoff', hidden)).toBeOnTheScreen();
    expect(view.getByTestId('splash-handoff-mark', hidden)).toBeOnTheScreen();
  });

  it('cross-fades out over about 200 ms once released', async () => {
    const view = await render(<SplashHandoff released />);
    // Still there just before the fade has run its course.
    await act(async () => {
      jest.advanceTimersByTime(HANDOFF_FADE_MS - 20);
    });
    expect(view.getByTestId('splash-handoff', hidden)).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
  });

  it('draws a single, still mark: nothing travels to the lock screen', async () => {
    const view = await render(<SplashHandoff released />);
    const marks = view.getAllByTestId('splash-handoff-mark', hidden);
    expect(marks).toHaveLength(1);
    expect(marks[0]).not.toHaveStyle({ transform: expect.anything() });
  });

  it('tells the navigator when it is gone', async () => {
    const onDone = jest.fn();
    await render(<SplashHandoff released onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(HANDOFF_FADE_MS + 100);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('goes at once with reduced motion', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const onDone = jest.fn();
    const view = await render(<SplashHandoff released onDone={onDone} />);
    expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('always clears by the hard stop, even if no frame is drawn', async () => {
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 0);
    const view = await render(<SplashHandoff released />);
    await act(async () => {
      jest.advanceTimersByTime(HANDOFF_FALLBACK_MS - 10);
    });
    expect(view.getByTestId('splash-handoff', hidden)).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
  });

  it('repaints the dark splash when the system is dark', async () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
    const view = await render(<SplashHandoff released={false} />);
    expect(view.getByTestId('splash-handoff', hidden)).toHaveStyle({
      backgroundColor: darkColors.background,
    });
    expect(view.getByTestId('splash-handoff-mark', hidden)).toHaveStyle({
      backgroundColor: darkColors.primaryMuted,
    });
  });

  it('repaints the light splash when the system is light', async () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
    const view = await render(<SplashHandoff released={false} />);
    expect(view.getByTestId('splash-handoff', hidden)).toHaveStyle({
      backgroundColor: lightColors.background,
    });
    expect(view.getByTestId('splash-handoff-mark', hidden)).toHaveStyle({
      backgroundColor: lightColors.primary,
    });
  });

  it('keeps the system colours when a pinned Appearance lands mid-splash', async () => {
    const scheme = jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
    const view = await render(<SplashHandoff released={false} />);
    // The stored setting pins dark after mount, as loadAppearance does.
    scheme.mockReturnValue('dark');
    await view.rerender(<SplashHandoff released={false} />);
    expect(view.getByTestId('splash-handoff', hidden)).toHaveStyle({
      backgroundColor: lightColors.background,
    });
  });

  describe('when the pinned Appearance differs from the system scheme', () => {
    beforeEach(() => {
      jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
      jest.spyOn(AppearanceSetting, 'getAppearance').mockReturnValue('dark');
    });

    it('stays opaque in the system colours, then goes at once instead of fading', async () => {
      const fade = jest.spyOn(Reanimated, 'withTiming');
      const onDone = jest.fn();
      const view = await render(<SplashHandoff released onDone={onDone} />);
      await act(async () => {
        jest.advanceTimersByTime(HANDOFF_FADE_MS - 20);
      });
      const overlay = view.getByTestId('splash-handoff', hidden);
      expect(overlay).toHaveStyle({ backgroundColor: lightColors.background, opacity: 1 });
      expect(onDone).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(40);
      });
      expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(fade).not.toHaveBeenCalled();
    });

    it('is held the same way with reduced motion, then goes at once', async () => {
      jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
      const view = await render(<SplashHandoff released />);
      expect(view.getByTestId('splash-handoff', hidden)).toHaveStyle({
        backgroundColor: lightColors.background,
      });
      await act(async () => {
        jest.advanceTimersByTime(HANDOFF_FADE_MS + 20);
      });
      expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
    });

    it('still fades when the pinned scheme matches the system', async () => {
      jest.spyOn(AppearanceSetting, 'getAppearance').mockReturnValue('light');
      const fade = jest.spyOn(Reanimated, 'withTiming');
      await render(<SplashHandoff released />);
      await act(async () => {
        jest.advanceTimersByTime(HANDOFF_FADE_MS / 2);
      });
      expect(fade).toHaveBeenCalledWith(0, expect.objectContaining({ duration: HANDOFF_FADE_MS }));
    });
  });
});
