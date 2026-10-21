import { fireEvent, render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PageStage } from '../PageStage';

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

async function renderStage(onIndexChange: jest.Mock) {
  return render(
    <GestureHandlerRootView>
      <PageStage
        pages={pages}
        title="عقد الإيجار 2026.pdf"
        index={0}
        onIndexChange={onIndexChange}
        onTap={() => {}}
        onDismiss={() => {}}
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
});
