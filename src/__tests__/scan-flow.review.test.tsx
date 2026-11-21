import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { scanner, pickerFolder, plantScan, scanInto } from '@/testing/scanFlow';
import {
  queueScan,
  setCameraAvailable,
  setScannerSupported,
} from '@modules/expo-document-scanner/src/index.mock';

import { documentService } from '../services/DocumentService';

jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

beforeEach(() => {
  setScannerSupported(true);
  setCameraAvailable(true);
});

afterEach(() => {
  for (const directory of [scanner(), pickerFolder()]) {
    if (directory.exists) directory.delete();
  }
  queueScan([]);
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('Add a document: review pages', () => {
  it('lists the scanned pages with Discard, Continue and Add pages', async () => {
    const { view } = await scanInto(3);

    expect(view.getByRole('button', { name: 'Discard' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Add pages' })).toBeOnTheScreen();
    expect(view.getByLabelText('Page 1 of 3')).toBeOnTheScreen();
    expect(view.getByLabelText('Page 3 of 3')).toBeOnTheScreen();
  });

  it('removes a page and its plaintext copy at once', async () => {
    const { view, pages } = await scanInto(3);

    await fireEvent.press(view.getByRole('button', { name: 'Remove page 2' }));

    expect(view.getByText('2 pages')).toBeOnTheScreen();
    expect(pages.map((page) => page.exists)).toEqual([true, false, true]);
  });

  it('returns to the sources when the last page is removed', async () => {
    const { view, pages } = await scanInto(1);

    await fireEvent.press(view.getByRole('button', { name: 'Remove page 1' }));

    expect(view.getByRole('button', { name: /Import a file/ })).toBeOnTheScreen();
    expect(pages[0]?.exists).toBe(false);
  });

  it('discards every page', async () => {
    const { view, pages } = await scanInto(2);

    await fireEvent.press(view.getByRole('button', { name: 'Discard' }));

    expect(pages.map((page) => page.exists)).toEqual([false, false]);
    expect(view.getByRole('button', { name: /Scan with the camera/ })).toBeOnTheScreen();
  });

  it('reorders with the screen reader actions and saves in the new order', async () => {
    const add = jest.spyOn(documentService, 'addDocument');
    const { view, pages } = await scanInto(3);

    await fireEvent(view.getByLabelText('Page 1 of 3'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveLater' },
    });
    await fireEvent(view.getByLabelText('Page 3 of 3'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveEarlier' },
    });
    // Now 2, 3, 1.
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
    });

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    const saved = add.mock.calls[0]?.[0] as { uri: string }[];
    expect(saved.map((page) => page.uri)).toEqual([pages[1]?.uri, pages[2]?.uri, pages[0]?.uri]);
  });

  it('removes a page with the screen reader action', async () => {
    const { view, pages } = await scanInto(2);

    await fireEvent(view.getByLabelText('Page 2 of 2'), 'accessibilityAction', {
      nativeEvent: { actionName: 'remove' },
    });

    expect(view.getByText('1 page')).toBeOnTheScreen();
    expect(pages[1]?.exists).toBe(false);
  });

  it('moves a page held down with the Move earlier and Move later buttons', async () => {
    const add = jest.spyOn(documentService, 'addDocument');
    const { view, pages } = await scanInto(2);

    await fireEvent(view.getByLabelText('Page 1 of 2'), 'longPress');
    expect(view.getByLabelText('Page 1 of 2, moving')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Move later' }));
    expect(view.getByLabelText('Page 2 of 2, moving')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Done' }));
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
    });

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    const saved = add.mock.calls[0]?.[0] as { uri: string }[];
    expect(saved.map((page) => page.uri)).toEqual([pages[1]?.uri, pages[0]?.uri]);
  });

  it('adds pages from another scan after the ones already there', async () => {
    const { view, pages } = await scanInto(2);
    const more = plantScan(1, 10);

    await fireEvent.press(view.getByRole('button', { name: 'Add pages' }));

    await waitFor(() => expect(view.getByText('3 pages')).toBeOnTheScreen());
    expect([...pages, ...more].every((page) => page.exists)).toBe(true);
  });

  it('removes pages an added scan hands back after the screen has closed', async () => {
    const { view, pages } = await scanInto(1);
    const late = plantScan(1, 10);
    let answer: () => void = () => {};
    const scanModule = jest.requireMock('@modules/expo-document-scanner') as {
      scanDocuments: () => Promise<unknown>;
    };
    const original = scanModule.scanDocuments;
    const gate = new Promise<void>((resolve) => (answer = resolve));
    scanModule.scanDocuments = async () => {
      await gate;
      return original();
    };
    try {
      await act(async () => {
        void fireEvent.press(view.getByRole('button', { name: 'Add pages' }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      await act(async () => {
        view.unmount();
      });
      expect(pages[0]?.exists).toBe(false);
      await act(async () => {
        answer();
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(late[0]?.exists).toBe(false);
    } finally {
      scanModule.scanDocuments = original;
    }
  });

  it('removes the pages when the screen closes during review', async () => {
    const { view, pages } = await scanInto(2);

    await act(async () => {
      view.unmount();
    });

    expect(pages.map((page) => page.exists)).toEqual([false, false]);
  });

  it('goes back from the details to the pages it read, keeping them', async () => {
    const { view, pages } = await scanInto(2);
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());

    await fireEvent.press(view.getByLabelText('Back to pages'));

    expect(view.getByText('2 pages')).toBeOnTheScreen();
    expect(pages.every((page) => page.exists)).toBe(true);
  });
});

describe('Add a document: reorder at the ends', () => {
  const actionNames = (element: { props: { accessibilityActions?: { name: string }[] } }) =>
    (element.props.accessibilityActions ?? []).map((action) => action.name);

  it('offers no move past either end', async () => {
    const { view } = await scanInto(3);

    expect(actionNames(view.getByLabelText('Page 1 of 3'))).toEqual(['moveLater', 'remove']);
    expect(actionNames(view.getByLabelText('Page 2 of 3'))).toEqual([
      'moveEarlier',
      'moveLater',
      'remove',
    ]);
    expect(actionNames(view.getByLabelText('Page 3 of 3'))).toEqual(['moveEarlier', 'remove']);
  });

  it('announces where a moved page landed', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { view } = await scanInto(3);

    await fireEvent(view.getByLabelText('Page 1 of 3'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveLater' },
    });
    expect(announce).toHaveBeenLastCalledWith('Moved to page 2 of 3');

    await fireEvent(view.getByLabelText('Page 3 of 3'), 'longPress');
    await fireEvent.press(view.getByRole('button', { name: 'Move earlier' }));
    expect(announce).toHaveBeenLastCalledWith('Moved to page 2 of 3');
  });
});
