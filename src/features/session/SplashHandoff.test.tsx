import { act, fireEvent, render } from '@testing-library/react-native';

import { markGlyphSize } from '@/components/ui/Mark';

import {
  planHandoff,
  reportSplashTarget,
  resetSplashTarget,
  SPLASH_MARK,
  SplashHandoff,
} from './SplashHandoff';

const hidden = { includeHiddenElements: true };
const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } };

describe('SplashHandoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetSplashTarget();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('repaints the splash mark until the native splash hides', async () => {
    const view = await render(<SplashHandoff released={false} />);
    await fireEvent(view.getByTestId('splash-handoff', hidden), 'layout', layout);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(view.getByTestId('splash-handoff', hidden)).toBeOnTheScreen();
    expect(view.getByTestId('splash-handoff-mark-fade', hidden)).toBeOnTheScreen();
  });

  it('hands off to the lock screen mark and then gets out of the way', async () => {
    const view = await render(<SplashHandoff released />);
    reportSplashTarget({ x: 163, y: 110, size: 64 });
    await fireEvent(view.getByTestId('splash-handoff', hidden), 'layout', layout);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
  });

  it('cross-fades when no screen reports a mark', async () => {
    const view = await render(<SplashHandoff released />);
    await fireEvent(view.getByTestId('splash-handoff', hidden), 'layout', layout);
    // The wait for a mark runs out first, then the fade.
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
  });

  it('still clears when the window resizes mid-handoff', async () => {
    const view = await render(<SplashHandoff released />);
    reportSplashTarget({ x: 163, y: 110, size: 64 });
    const root = () => view.getByTestId('splash-handoff', hidden);
    await fireEvent(root(), 'layout', layout);
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    // Split View, Stage Manager, or a foldable resizes the root mid-animation.
    await fireEvent(root(), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 844 } },
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    await fireEvent(root(), 'layout', layout);
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
  });

  it('always clears shortly after release, even with no layout', async () => {
    const view = await render(<SplashHandoff released />);
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(view.queryByTestId('splash-handoff', hidden)).toBeNull();
  });

  it('fades instead of gliding when the lock screen turns out to be locked out', async () => {
    const view = await render(<SplashHandoff released />);
    reportSplashTarget({ x: 163, y: 110, size: 64 });
    await fireEvent(view.getByTestId('splash-handoff', hidden), 'layout', layout);
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    expect(view.getByTestId('splash-handoff-mark-glide', hidden)).toBeOnTheScreen();
    // The lockout lands after the first report: the clock squircle is no target.
    await act(async () => {
      reportSplashTarget(null);
    });
    expect(view.getByTestId('splash-handoff-mark-fade', hidden)).toBeOnTheScreen();
  });

  it('lands the glyph at the lock mark size, not the scaled splash glyph', () => {
    const plan = planHandoff({ x: 163, y: 110, size: 64 }, { width: 390, height: 844 });
    expect(plan.scale).toBeCloseTo(64 / 72, 5);
    expect(plan.scale * plan.glyphScale * markGlyphSize(SPLASH_MARK)).toBeCloseTo(38, 5);
    expect(plan.dx).toBe(0);
    expect(plan.dy).toBe(110 + 32 - 422);
  });
});
