import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, Linking, Text } from 'react-native';

import AddDocumentScreen from '../../app/documents/add';
import vault from '../../modules/expo-vault';
import {
  queueScan,
  setCameraAvailable,
  setScannerSupported,
} from '../../modules/expo-document-scanner/src/index.mock';
import { ToastProvider } from '../components/ui';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import {
  APPLE_INBOX_DIRECTORY,
  documentService,
  PICKER_DIRECTORY,
  SCANNER_DIRECTORY,
} from '../services/DocumentService';
import { ocrService } from '../services/OcrService';
import { isolate } from '../utils/bidi';

jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const pickDocument = DocumentPicker.getDocumentAsync as jest.Mock;
const scanner = () => new Directory(Paths.cache, SCANNER_DIRECTORY);
const pickerFolder = () => new Directory(Paths.cache, PICKER_DIRECTORY);

const PASSPORT_TEXT = `REPUBLIC OF EXAMPLE
PASSPORT
Passport No: X12344821
Surname: DOE
Date of expiry: 12 MAR 2030`;

function plant(directory: Directory, name: string) {
  if (!directory.exists) directory.create({ intermediates: true });
  const copy = new File(directory, name);
  copy.writeSync('plaintext');
  return copy;
}

function plantScan(count: number, start = 1) {
  const pages = Array.from({ length: count }, (_, index) =>
    plant(scanner(), `${1000 + start + index}.jpg`),
  );
  queueScan(pages.map((page) => ({ uri: page.uri, width: 10, height: 10 })));
  return pages;
}

function renderScreen() {
  return render(
    <SessionProvider>
      <ToastProvider>
        <AddDocumentScreen />
      </ToastProvider>
    </SessionProvider>,
  );
}

const settle = (ms = 20) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

async function scanInto(count: number) {
  const pages = plantScan(count);
  const view = await renderScreen();
  await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
  await waitFor(() =>
    expect(view.getByText(count === 1 ? '1 page' : `${count} pages`)).toBeOnTheScreen(),
  );
  return { view, pages };
}

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

describe('Add a document: sources', () => {
  it('offers the scanner, a photo, Photos and Files with the encryption footer', async () => {
    const view = await renderScreen();

    expect(view.getByText('Add a document')).toBeOnTheScreen();
    for (const name of [
      /Scan with the camera/,
      /Take a photo/,
      /Choose from Photos/,
      /Import a file/,
    ]) {
      expect(view.getByRole('button', { name })).toBeEnabled();
    }
    expect(
      view.getByText(
        'Pages are encrypted on this device before they’re saved. The original photo or file is left where it was.',
      ),
    ).toBeOnTheScreen();
  });

  it('disables both camera rows with the reason on a device without a camera', async () => {
    setScannerSupported(false);
    setCameraAvailable(false);
    const view = await renderScreen();

    const scan = view.getByLabelText('Scan with the camera, This device has no camera');
    const photo = view.getByLabelText('Take a photo, This device has no camera');
    expect(scan).toBeDisabled();
    expect(photo).toBeDisabled();
    await fireEvent.press(scan);
    await fireEvent.press(photo);

    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: /Choose from Photos/ })).toBeEnabled();
  });

  it('shows the camera-off callout inline with Open Settings when access is refused', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    } as never);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Take a photo/ }));

    await waitFor(() =>
      expect(
        view.getByText(
          'Camera access is off for SecureVault. Turn it on in Settings to scan, or add a photo or file instead.',
        ),
      ).toBeOnTheScreen(),
    );
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(view.queryByRole('button', { name: /Take a photo/ })).toBeNull();
    expect(view.queryByRole('button', { name: /Scan with the camera/ })).toBeNull();
    expect(view.getByRole('button', { name: /Choose from Photos/ })).toBeEnabled();
    expect(view.getByRole('button', { name: /Import a file/ })).toBeEnabled();
    // Inline, never the old toast.
    expect(view.queryByText(/Enable it in Settings/)).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Open Settings' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('shows the callout straight away when camera access was already refused', async () => {
    picker.getCameraPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    } as never);
    const view = await renderScreen();

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Open Settings' })).toBeOnTheScreen(),
    );
  });

  it('asks for the camera before the iOS scanner and stops when refused', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    } as never);
    const pages = plantScan(1);
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Open Settings' })).toBeOnTheScreen(),
    );
    // The scan never ran, so its queued page is still waiting.
    expect(pages[0]?.exists).toBe(true);
  });

  it('opens the system photo picker without asking for photo library access', async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Choose from Photos/ }));

    await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
    expect(picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('Add a document: import errors', () => {
  function queueFile(name: string, mimeType: string | undefined) {
    const copy = plant(pickerFolder(), '8F0C2A41-6B3D-4E8A-9F11-2C7D5E0B9A13');
    pickDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: copy.uri, name, mimeType, size: 9 }],
    });
    return copy;
  }

  it('refuses an unsupported file inline, removes its copies and offers another pick', async () => {
    const documents = jest
      .spyOn(Paths, 'document', 'get')
      .mockReturnValue(new Directory('file:///mock/Documents/'));
    const inbox = new Directory(`file:///mock/tmp/${APPLE_INBOX_DIRECTORY}/`);
    inbox.create({ intermediates: true });
    const original = new File(inbox, 'budget-final.numbers');
    original.writeSync('plaintext');
    try {
      const copy = queueFile('budget-final.numbers', 'application/x-iwork-numbers-sffnumbers');
      const view = await renderScreen();

      await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));

      await waitFor(() =>
        expect(
          view.getByText(
            `${isolate('budget-final.numbers')} can’t be added. Choose a PDF or an image (JPEG, PNG, HEIC).`,
          ),
        ).toBeOnTheScreen(),
      );
      expect(copy.exists).toBe(false);
      expect(original.exists).toBe(false);
      expect(view.queryByLabelText('Title')).toBeNull();
      // Size limits are still open (D9): no limit sentence is shown.
      expect(view.queryByText(/larger than/)).toBeNull();

      const again = queueFile('lease.pdf', 'application/pdf');
      await fireEvent.press(view.getByRole('button', { name: /Choose another file/ }));
      await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
      expect(again.exists).toBe(true);
    } finally {
      documents.mockRestore();
      new Directory('file:///mock/tmp/').delete();
    }
  });

  it('refuses a PDF whose pages cannot be read and removes the copy', async () => {
    jest.spyOn(vault, 'renderPdfPages').mockRejectedValueOnce(new Error('PDF_RENDER_FAILED'));
    const copy = queueFile('damaged.pdf', 'application/pdf');
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));

    await waitFor(() => expect(view.getByText(new RegExp('can’t be added'))).toBeOnTheScreen());
    expect(copy.exists).toBe(false);
  });

  it('accepts a file the picker did not type when its extension is supported', async () => {
    const copy = queueFile('photo.png', undefined);
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));

    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    expect(copy.exists).toBe(true);
  });
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
    const scanModule = jest.requireMock('../../modules/expo-document-scanner') as {
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

describe('Add a document: processing', () => {
  it('shows each reading step and cancels back to the pages already chosen', async () => {
    let finish: (value: { text: string; blocks: [] }) => void = () => {};
    jest
      .spyOn(ocrService, 'extractText')
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const { view, pages } = await scanInto(2);

    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));

    expect(view.getByText('Reading the document')).toBeOnTheScreen();
    expect(view.getByLabelText('Reading the text, in progress')).toBeOnTheScreen();
    expect(view.getByLabelText('Encrypting, not started')).toBeOnTheScreen();
    expect(
      view.getByText(
        'Text is read on this device. Google ML Kit sends Google usage metrics, but not your pages or their text.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));

    // The pages were chosen in review; Cancel stops the reading, not the scan.
    expect(view.getByText('2 pages')).toBeOnTheScreen();
    expect(pages.map((page) => page.exists)).toEqual([true, true]);

    // A late result from the cancelled read changes nothing.
    await act(async () => {
      finish({ text: PASSPORT_TEXT, blocks: [] });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(view.queryByLabelText('Title')).toBeNull();
    expect(view.getByText('2 pages')).toBeOnTheScreen();

    // Discard from there still removes them.
    await fireEvent.press(view.getByRole('button', { name: 'Discard' }));
    expect(pages.map((page) => page.exists)).toEqual([false, false]);
  });

  it('removes a picked file when reading is cancelled', async () => {
    jest.spyOn(ocrService, 'extractText').mockImplementationOnce(() => new Promise(() => {}));
    const copy = plant(pickerFolder(), '5A1E9C70-0D2B-4F6E-8C3A-7B4D1E2F3A90');
    pickDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: copy.uri, name: 'passport.jpg', mimeType: 'image/jpeg', size: 9 }],
    });
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));

    expect(copy.exists).toBe(false);
  });

  it('hides Cancel once encrypting starts and says it cannot be stopped', async () => {
    let release: () => void = () => {};
    const putFile = jest
      .spyOn(vault, 'putFile')
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { view } = await scanInto(1);
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());

    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(putFile).toHaveBeenCalled();
    expect(view.getByLabelText('Encrypting, in progress')).toBeOnTheScreen();
    expect(view.getByLabelText('Reading the text, done')).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(view.queryByLabelText('Cancel')).toBeNull();
    expect(view.getByText(/This can’t be stopped/)).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('This can’t be stopped.'));

    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('shows a failed save inline, keeps the pages, and saves once on Try again', async () => {
    const putFile = jest.spyOn(vault, 'putFile').mockImplementationOnce(async () => {
      throw new Error('The disk is full.');
    });
    const before = (await documentService.getAllDocuments()).length;
    const { view, pages } = await scanInto(1);
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
    });

    await waitFor(() => expect(view.getByRole('alert')).toBeOnTheScreen());
    expect(within(view.getByRole('alert')).getByText(/The disk is full/)).toBeOnTheScreen();
    expect(pages[0]?.exists).toBe(true);
    expect(router.back).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: 'Back to details' })).toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
    });

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(pages[0]?.exists).toBe(false);
    expect(await documentService.getAllDocuments()).toHaveLength(before + 1);
    putFile.mockRestore();
  });

  it('does not save the document twice when only its found values failed', async () => {
    jest
      .spyOn(ocrService, 'extractText')
      .mockResolvedValueOnce({ text: PASSPORT_TEXT, blocks: [] });
    const setFields = jest
      .spyOn(documentService, 'setFields')
      .mockRejectedValueOnce(new Error('index busy'));
    const add = jest.spyOn(documentService, 'addDocument');
    const { view } = await scanInto(1);
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
    });
    await waitFor(() => expect(view.getByRole('button', { name: 'Try again' })).toBeOnTheScreen());
    // The document is already in the vault, so its details can't change now.
    expect(view.queryByRole('button', { name: 'Back to details' })).toBeNull();
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
    });

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(add).toHaveBeenCalledTimes(1);
    expect(setFields).toHaveBeenCalledTimes(2);
  });
});

describe('Add a document: details', () => {
  async function readPassport() {
    jest
      .spyOn(ocrService, 'extractText')
      .mockResolvedValueOnce({ text: PASSPORT_TEXT, blocks: [] });
    const { view, pages } = await scanInto(1);
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    return { view, pages };
  }

  it('prefills the suggestions, marks the collection as suggested and masks numbers', async () => {
    const { view } = await readPassport();

    expect(view.getByText('New document')).toBeOnTheScreen();
    expect(view.getByLabelText('Title').props.value).toBe('Republic Of Example');
    expect(view.getByText('suggested', { exact: false })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'ID & Personal' })).toBeSelected();
    expect(view.getByText('No. •••• 4821')).toBeOnTheScreen();
    expect(view.queryByText(/X12344821/)).toBeNull();
    expect(view.getByText('Guessed on this device. Tap × to remove a value.')).toBeOnTheScreen();
  });

  it('drops a found value with its remove button and saves without it', async () => {
    const setFields = jest.spyOn(documentService, 'setFields');
    const { view } = await readPassport();

    await fireEvent.press(view.getByRole('button', { name: 'Remove ⁨No. •••• 4821⁩' }));
    expect(view.queryByText('No. •••• 4821')).toBeNull();
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
    });

    await waitFor(() => expect(setFields).toHaveBeenCalledTimes(1));
    expect(setFields.mock.calls[0]?.[1].map((field) => field.key)).toEqual(['expires']);
  });

  it('asks for a title inline instead of saving', async () => {
    const add = jest.spyOn(documentService, 'addDocument');
    const { view } = await readPassport();

    await fireEvent.changeText(view.getByLabelText('Title'), '   ');
    await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));

    expect(view.getByText('Give the document a title.')).toBeOnTheScreen();
    expect(add).not.toHaveBeenCalled();
    expect(view.queryByText('Give the document a title first.')).toBeNull();
    await fireEvent.changeText(view.getByLabelText('Title'), 'Passport');
    expect(view.queryByText('Give the document a title.')).toBeNull();
  });

  it('lands on the Library with a View toast once saved', async () => {
    const { view, pages } = await readPassport();

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
    });

    await waitFor(() => expect(view.getByText('Saved with searchable text')).toBeOnTheScreen());
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(pages[0]?.exists).toBe(false);
    await fireEvent.press(view.getByRole('button', { name: 'View' }));
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/documents\//));
  });
});

describe('Add a document: the lock', () => {
  let session: ReturnType<typeof useSession>;

  beforeEach(() => {
    (vault as unknown as { reset(): void }).reset();
    (SecureStore as unknown as { __reset(): void }).__reset();
  });

  afterEach(() => {
    (vault as unknown as { reset(): void }).reset();
    (SecureStore as unknown as { __reset(): void }).__reset();
  });

  function Gate() {
    const value = useSession();
    useEffect(() => {
      session = value;
    });
    return value.status === 'unlocked' ? <AddDocumentScreen /> : <Text>{value.status}</Text>;
  }

  async function renderUnlocked() {
    const view = await render(
      <SessionProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </SessionProvider>,
    );
    await waitFor(() => expect(view.getByText('setup')).toBeOnTheScreen());
    await act(async () => {
      await session.setUp('123456');
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
  await settle();

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
    await settle();
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
