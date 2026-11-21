import { fireEvent, waitFor } from '@testing-library/react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { Linking } from 'react-native';

import {
  picker,
  pickDocument,
  scanner,
  pickerFolder,
  plant,
  plantScan,
  renderScreen,
} from '@/testing/scanFlow';
import * as scannerMock from '@modules/expo-document-scanner/src/index.mock';
import {
  queueScan,
  setCameraAvailable,
  setScannerSupported,
} from '@modules/expo-document-scanner/src/index.mock';
import vault from '@modules/expo-vault';

import { APPLE_INBOX_DIRECTORY } from '../services/DocumentService';
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

describe('Add a document: source failures', () => {
  const RAW =
    "Call to function 'ExpoDocumentScanner.scanDocuments' has been rejected. → Caused by: java.lang.NullPointerException";

  it.each([
    [
      'SCANNER_UNAVAILABLE',
      'The document scanner isn’t available on this phone right now. Take a photo or import a file instead.',
    ],
    ['SCAN_FAILED', 'The scan didn’t finish. Try again, or take a photo instead.'],
    ['NO_ACTIVITY', 'The document scanner couldn’t open. Try again, or take a photo instead.'],
    [undefined, 'The document scanner couldn’t open. Try again, or take a photo instead.'],
  ])('shows a plain sentence, never the native text, for a scanner %s', async (code, sentence) => {
    jest
      .spyOn(scannerMock, 'scanDocuments')
      .mockRejectedValueOnce(Object.assign(new Error(RAW), code ? { code } : {}));
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));

    await waitFor(() => expect(view.getByText(sentence)).toBeOnTheScreen());
    expect(view.queryByText(/ExpoDocumentScanner|NullPointerException|rejected/)).toBeNull();
  });

  it.each([
    ['Take a photo', 'launchCameraAsync', 'The camera couldn’t open. Try again in a moment.'],
    [
      'Choose from Photos',
      'launchImageLibraryAsync',
      'Photos couldn’t open. Try again in a moment.',
    ],
  ] as const)('keeps the native text out when %s fails', async (row, call, sentence) => {
    picker[call].mockRejectedValueOnce(
      new Error("Call to function 'ExponentImagePicker.launch' has been rejected. → Caused by: E"),
    );
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: new RegExp(row) }));

    await waitFor(() => expect(view.getByText(sentence)).toBeOnTheScreen());
    expect(view.queryByText(/ExponentImagePicker|rejected/)).toBeNull();
  });

  it('keeps the native text out when the file picker fails', async () => {
    pickDocument.mockRejectedValueOnce(
      new Error('Different document picking in progress. Await other document picking first'),
    );
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));

    await waitFor(() =>
      expect(
        view.getByText('That file couldn’t be opened. Try again, or choose another file.'),
      ).toBeOnTheScreen(),
    );
    expect(view.queryByText(/document picking/)).toBeNull();
  });
});

describe('Add a document: photo titles', () => {
  it('titles a photo that has only a media id as a dated photo, not the id', async () => {
    const photo = plant(new Directory(Paths.cache, 'ImagePicker'), '7233.jpg');
    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: photo.uri, fileName: '7233', mimeType: 'image/jpeg' }],
    } as never);
    jest.spyOn(ocrService, 'extractText').mockResolvedValue({ text: '', blocks: [] } as never);
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Choose from Photos/ }));

    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    expect(view.getByLabelText('Title').props.value).toMatch(/^Photo \S/);
    expect(view.getByLabelText('Title').props.value).not.toMatch(/7233/);
    new Directory(Paths.cache, 'ImagePicker').delete();
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

  it('says a password-protected PDF needs its password removed, and offers another pick', async () => {
    jest
      .spyOn(vault, 'renderPdfPages')
      .mockRejectedValueOnce(new Error('Failed to render the PDF: file requires password'));
    const copy = plant(pickerFolder(), '5D2B7C90-1E4F-4A3B-8C6D-0F9E8A7B6C5D');
    copy.writeSync('%PDF-1.7\ntrailer\n<</Root 1 0 R/Encrypt 4 0 R/Size 5>>\n%%EOF');
    pickDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: copy.uri, name: 'protected.pdf', mimeType: 'application/pdf', size: 60 }],
    });
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));

    await waitFor(() =>
      expect(
        view.getByText(
          `${isolate('protected.pdf')} is password-protected. Remove the password and import it again.`,
        ),
      ).toBeOnTheScreen(),
    );
    expect(view.queryByText(/can’t be added/)).toBeNull();
    expect(copy.exists).toBe(false);
    expect(view.getByRole('button', { name: /Choose another file/ })).toBeOnTheScreen();
  });

  it('accepts a file the picker did not type when its extension is supported', async () => {
    const copy = queueFile('photo.png', undefined);
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));

    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    expect(copy.exists).toBe(true);
  });
});
