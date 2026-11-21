import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { Paths } from 'expo-file-system';
import { router } from 'expo-router';

import { settle } from '@/testing/async';
import { renderUnlockedScreen } from '@/testing/renderUnlocked';
import {
  picker,
  pickDocument,
  scanner,
  pickerFolder,
  PASSPORT_TEXT,
  plant,
  plantScan,
  renderScreen,
  scanInto,
} from '@/testing/scanFlow';
import { secureStoreMock } from '@/testing/secureStore';
import type { Session } from '@/testing/session';
import { vaultMock } from '@/testing/vault';
import {
  queueScan,
  setCameraAvailable,
  setScannerSupported,
} from '@modules/expo-document-scanner/src/index.mock';
import vault from '@modules/expo-vault';

import AddDocumentScreen from '../../app/documents/add';
import { documentService } from '../services/DocumentService';
import { ocrService } from '../services/OcrService';

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

describe('Add a document: the lock', () => {
  let session: Session;

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  afterEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  async function renderUnlocked() {
    const view = await renderUnlockedScreen(<AddDocumentScreen />, {
      onSession: (value) => {
        session = value;
      },
    });
    return view;
  }

  it('removes the pages under review when the vault locks', async () => {
    const pages = plantScan(2);
    const view = await renderUnlocked();
    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
    await waitFor(() => expect(view.getByText('2 pages')).toBeOnTheScreen());

    await act(async () => {
      session.lock();
    });

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(pages.map((page) => page.exists)).toEqual([false, false]);
  });

  it('removes the pages being read when the vault locks, and ignores the late result', async () => {
    let finish: (value: { text: string; blocks: [] }) => void = () => {};
    jest
      .spyOn(ocrService, 'extractText')
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const pages = plantScan(1);
    const view = await renderUnlocked();
    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
    await waitFor(() => expect(view.getByText('1 page')).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));

    await act(async () => {
      session.lock();
    });
    await act(async () => {
      finish({ text: PASSPORT_TEXT, blocks: [] });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(pages[0]?.exists).toBe(false);
    expect(view.getByText('locked')).toBeOnTheScreen();
  });

  it('does not start writing when the vault locked before the save began', async () => {
    const pages = plantScan(1);
    const view = await renderUnlocked();
    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
    await waitFor(() => expect(view.getByText('1 page')).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    const putFile = jest.spyOn(vault, 'putFile');
    jest.spyOn(documentService, 'initialize').mockImplementationOnce(async () => {
      session.lock();
    });

    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(putFile).not.toHaveBeenCalled();
    expect(pages[0]?.exists).toBe(false);
    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(session.notice).toEqual({ message: 'Could not save the document.', tone: 'danger' });
  });
});

it('keeps a settled toast-free flow when nothing is picked', async () => {
  pickDocument.mockResolvedValueOnce({ canceled: true, assets: null });
  const view = await renderScreen();

  await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));
  await settle(20);

  expect(view.getByRole('button', { name: /Import a file/ })).toBeOnTheScreen();
  expect(view.queryByRole('alert')).toBeNull();
});

describe('Add a document: one source at a time', () => {
  it('ignores another source while a picked PDF is still rendering', async () => {
    let rendered: (pages: { uri: string; width: number; height: number }[]) => void = () => {};
    jest
      .spyOn(vault, 'renderPdfPages')
      .mockImplementationOnce(() => new Promise((resolve) => (rendered = resolve)));
    const copy = plant(pickerFolder(), '5A1E9C70-0D2B-4F6E-8C3A-7B4D1E2F3A90');
    pickDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: copy.uri, name: 'lease.pdf', mimeType: 'application/pdf', size: 9 }],
    });
    const view = await renderScreen();
    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: /Import a file/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await fireEvent.press(view.getByRole('button', { name: /Choose from Photos/ }));
    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
    await settle(20);
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();

    await act(async () => {
      rendered([{ uri: `${Paths.cache.uri}pages_preview_1/page_1.jpg`, width: 1, height: 1 }]);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    expect(copy.exists).toBe(true);

    // Once that pick has settled the sources answer again.
    await fireEvent.press(view.getByLabelText('Back to sources'));
    expect(copy.exists).toBe(false);
    await fireEvent.press(view.getByRole('button', { name: /Choose from Photos/ }));
    await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  });
});

describe('Add a document: saved without its found values', () => {
  it('offers to open the saved document when the found values keep failing', async () => {
    jest
      .spyOn(ocrService, 'extractText')
      .mockResolvedValueOnce({ text: PASSPORT_TEXT, blocks: [] });
    jest.spyOn(documentService, 'setFields').mockRejectedValue(new Error('index busy'));
    const add = jest.spyOn(documentService, 'addDocument');
    const { view } = await scanInto(1);
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
    });
    await waitFor(() => expect(view.getByRole('button', { name: 'Try again' })).toBeOnTheScreen());
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
    });
    await waitFor(() => expect(view.getByRole('button', { name: 'Try again' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Open document' }));

    const saved = await add.mock.results[0]?.value;
    expect(add).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/documents/${saved.id}`);
  });
});
