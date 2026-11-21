import { act, render } from '@testing-library/react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { useSharedValue } from 'react-native-reanimated';

import { ZoomablePage } from '../ZoomablePage';

// One shared value per component, as on device (see PageStage.test.tsx).
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

function Page({ onZoomChange }: { onZoomChange: (zoomed: boolean) => void }) {
  const progress = useSharedValue(0);
  return (
    <GestureHandlerRootView>
      <ZoomablePage
        uri="file:///p1.jpg"
        label="Page"
        onZoomChange={onZoomChange}
        onDismiss={() => {}}
        onTap={() => {}}
        dismissProgress={progress}
      />
    </GestureHandlerRootView>
  );
}

describe('ZoomablePage', () => {
  it('reports the zoom and enables the zoomed pan only while zoomed', async () => {
    const onZoomChange = jest.fn();
    await render(<Page onZoomChange={onZoomChange} />);
    expect(onZoomChange).not.toHaveBeenCalled();
    expect(getByGestureTestId('zoomable-page-pan').config.enabled).toBe(false);

    await act(async () => {
      fireGestureHandler(getByGestureTestId('zoomable-page-double-tap'), [
        { state: State.BEGAN, x: 195, y: 422 },
        { state: State.END, x: 195, y: 422 },
      ]);
    });
    expect(onZoomChange).toHaveBeenLastCalledWith(true);
    expect(getByGestureTestId('zoomable-page-pan').config.enabled).toBe(true);
    expect(getByGestureTestId('zoomable-page-dismiss').config.enabled).toBe(false);

    await act(async () => {
      fireGestureHandler(getByGestureTestId('zoomable-page-double-tap'), [
        { state: State.BEGAN, x: 195, y: 422 },
        { state: State.END, x: 195, y: 422 },
      ]);
    });
    expect(onZoomChange).toHaveBeenLastCalledWith(false);
    expect(getByGestureTestId('zoomable-page-pan').config.enabled).toBe(false);
  });
});
