import { act, fireEvent, render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { PageStage } from '../PageStage';

// The stock mock builds a new shared value on every render, which forgets a
// zoom as soon as the page re-renders, and its clamp returns nothing. Keep one
// value per component and clamp for real, as on device.
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<{ useState: <T>(init: () => T) => [T, unknown] }>('react');
  const mock = jest.requireActual('react-native-reanimated/mock');
  return {
    ...mock,
    useReducedMotion: () => false,
    clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
    useSharedValue: (init: unknown) => React.useState(() => mock.useSharedValue(init))[0],
  };
});

const pages = ['file:///p1.jpg', 'file:///p2.jpg', 'file:///p3.jpg'];

async function settle(view: Awaited<ReturnType<typeof render>>, offsetX: number) {
  await fireEvent(view.getByTestId('page-stage-pager'), 'momentumScrollEnd', {
    nativeEvent: {
      contentOffset: { x: offsetX, y: 0 },
      contentSize: { width: 390 * pages.length, height: 844 },
      layoutMeasurement: { width: 390, height: 844 },
    },
  });
}

async function renderStage(onIndexChange: jest.Mock, onDismiss: () => void = () => {}) {
  return render(
    <GestureHandlerRootView>
      <PageStage
        pages={pages}
        title="عقد الإيجار 2026.pdf"
        index={0}
        onIndexChange={onIndexChange}
        onTap={() => {}}
        onDismiss={onDismiss}
      />
    </GestureHandlerRootView>,
  );
}

describe('PageStage', () => {
  const original = I18nManager.isRTL;
  afterEach(() =>
    Object.defineProperty(I18nManager, 'isRTL', { value: original, configurable: true }),
  );

  it('reports the page under the left-edge offset in a left-to-right layout', async () => {
    Object.defineProperty(I18nManager, 'isRTL', { value: false, configurable: true });
    const onIndexChange = jest.fn();
    const view = await renderStage(onIndexChange);
    await settle(view, 390 * 2);
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
  });

  it('counts pages from the right end in a right-to-left layout', async () => {
    Object.defineProperty(I18nManager, 'isRTL', { value: true, configurable: true });
    const onIndexChange = jest.fn();
    const view = await renderStage(onIndexChange);
    // The second page sits one page in from the right end.
    await settle(view, 390);
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    await settle(view, 0);
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
  });

  it('names each page with the isolated title', async () => {
    const view = await renderStage(jest.fn());
    expect(view.getByLabelText('Page 2 of 3, ⁨عقد الإيجار 2026.pdf⁩')).toBeTruthy();
  });

  describe('gestures', () => {
    const gesture = (page: number, name: string) =>
      getByGestureTestId(`page-stage-page-${page}-${name}`);
    const pager = (view: Awaited<ReturnType<typeof render>>) =>
      view.getByTestId('page-stage-pager');

    async function pan(page: number, translationX: number, translationY = 0) {
      await act(async () => {
        fireGestureHandler(gesture(page, 'pan'), [
          { state: State.BEGAN, translationX: 0, translationY: 0 },
          { state: State.ACTIVE, translationX: 0, translationY: 0 },
          { state: State.ACTIVE, translationX, translationY },
          { state: State.END, translationX, translationY },
        ]);
      });
    }

    async function zoomIn(page: number) {
      await act(async () => {
        // A double tap in the middle zooms in without moving the page.
        fireGestureHandler(gesture(page, 'double-tap'), [
          { state: State.BEGAN, x: 195, y: 422 },
          { state: State.END, x: 195, y: 422 },
        ]);
      });
    }

    beforeEach(() =>
      Object.defineProperty(I18nManager, 'isRTL', { value: false, configurable: true }),
    );

    it('leaves a horizontal swipe at rest to the pager', async () => {
      const view = await renderStage(jest.fn());
      // An enabled pan would activate on any drag and claim it from the pager.
      expect(gesture(0, 'pan').config.enabled).toBe(false);
      expect(gesture(0, 'dismiss').config.enabled).not.toBe(false);
      expect(pager(view).props.scrollEnabled).toBe(true);
    });

    it('still dismisses on a downward drag at rest', async () => {
      const onDismiss = jest.fn();
      await renderStage(jest.fn(), onDismiss);
      await act(async () => {
        fireGestureHandler(gesture(0, 'dismiss'), [
          { state: State.BEGAN, translationY: 0 },
          { state: State.ACTIVE, translationY: 0 },
          { state: State.ACTIVE, translationY: 200 },
          { state: State.END, translationY: 200 },
        ]);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('pans a zoomed page and turns the page only from its edge', async () => {
      const onIndexChange = jest.fn();
      const view = await renderStage(onIndexChange);
      await zoomIn(0);
      expect(pager(view).props.scrollEnabled).toBe(false);
      expect(gesture(0, 'pan').config.enabled).toBe(true);

      // From the middle the drag only pans, settling against the right edge.
      await pan(0, -2000);
      expect(onIndexChange).not.toHaveBeenCalled();
      expect(pager(view).props.scrollEnabled).toBe(false);

      // Started at that edge and pulled past it, the drag turns the page.
      await pan(0, -100);
      expect(onIndexChange).toHaveBeenLastCalledWith(1);
      expect(pager(view).props.scrollEnabled).toBe(true);
      expect(gesture(0, 'pan').config.enabled).toBe(false);
    });

    it('keeps the zoom at the first page instead of paging past it', async () => {
      const onIndexChange = jest.fn();
      const view = await renderStage(onIndexChange);
      await zoomIn(0);
      await pan(0, 2000);
      await pan(0, 100);
      expect(onIndexChange).not.toHaveBeenCalled();
      expect(pager(view).props.scrollEnabled).toBe(false);
    });

    it('turns the page the mirrored way in a right-to-left layout', async () => {
      Object.defineProperty(I18nManager, 'isRTL', { value: true, configurable: true });
      const onIndexChange = jest.fn();
      await renderStage(onIndexChange);
      await zoomIn(0);
      // The next page sits to the left, so a drag to the right brings it in.
      await pan(0, 2000);
      await pan(0, 100);
      expect(onIndexChange).toHaveBeenLastCalledWith(1);
    });
  });
});
