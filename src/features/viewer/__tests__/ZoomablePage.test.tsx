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

function Page({ uri, onZoomChange }: { uri: string; onZoomChange: (zoomed: boolean) => void }) {
  const progress = useSharedValue(0);
  return (
    <GestureHandlerRootView>
      <ZoomablePage
        uri={uri}
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
  it('drops the zoom, and says so, when it is handed another page', async () => {
    const onZoomChange = jest.fn();
    const view = await render(<Page uri="file:///p1.jpg" onZoomChange={onZoomChange} />);
    expect(onZoomChange).not.toHaveBeenCalled();

    await act(async () => {
      fireGestureHandler(getByGestureTestId('zoomable-page-double-tap'), [
        { state: State.BEGAN, x: 195, y: 422 },
        { state: State.END, x: 195, y: 422 },
      ]);
    });
    expect(onZoomChange).toHaveBeenLastCalledWith(true);
    expect(getByGestureTestId('zoomable-page-pan').config.enabled).toBe(true);

    await act(async () => {
      view.rerender(<Page uri="file:///p2.jpg" onZoomChange={onZoomChange} />);
    });

    expect(onZoomChange).toHaveBeenLastCalledWith(false);
    expect(getByGestureTestId('zoomable-page-pan').config.enabled).toBe(false);
    expect(getByGestureTestId('zoomable-page-dismiss').config.enabled).not.toBe(false);
  });

  it('reports nothing for a new page while at rest', async () => {
    const onZoomChange = jest.fn();
    const view = await render(<Page uri="file:///p1.jpg" onZoomChange={onZoomChange} />);
    await act(async () => {
      view.rerender(<Page uri="file:///p2.jpg" onZoomChange={onZoomChange} />);
    });
    expect(onZoomChange).not.toHaveBeenCalled();
  });
});
