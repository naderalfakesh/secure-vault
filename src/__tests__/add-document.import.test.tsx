import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/features/session/SessionProvider';
import {
  APPLE_INBOX_DIRECTORY,
  documentService,
  PICKER_DIRECTORY,
} from '@/services/DocumentService';
import { renderUnlockedScreen } from '@/testing/renderUnlocked';
import { secureStoreMock } from '@/testing/secureStore';
import type { Session } from '@/testing/session';
import { vaultMock } from '@/testing/vault';
import {
  setCameraAvailable,
  setScannerSupported,
} from '@modules/expo-document-scanner/src/index.mock';
import vault from '@modules/expo-vault';

import AddDocumentScreen from '../../app/documents/add';

jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const pickDocument = DocumentPicker.getDocumentAsync as jest.Mock;

function renderScreen() {
  return render(
    <SessionProvider>
      <ToastProvider>
        <AddDocumentScreen />
      </ToastProvider>
    </SessionProvider>,
  );
}

describe('AddDocumentScreen capture row', () => {
  afterEach(() => {
    setScannerSupported(true);
    setCameraAvailable(true);
    jest.clearAllMocks();
  });

  it('offers the platform scanner and a plain photo when both exist', async () => {
    setScannerSupported(true);
    setCameraAvailable(true);
    const view = await renderScreen();

    expect(view.getByRole('button', { name: /Scan with the camera/ })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: /Take a photo/ })).toBeOnTheScreen();
  });

  it('leaves the scanner out when only a plain camera exists', async () => {
    setScannerSupported(false);
    setCameraAvailable(true);
    const view = await renderScreen();

    expect(view.queryByText('Scan with the camera')).toBeNull();
    expect(view.getByRole('button', { name: /Take a photo/ })).toBeEnabled();
  });

  it('falls back to a photo and opens the native camera when a camera exists', async () => {
    setScannerSupported(false);
    setCameraAvailable(true);
    const view = await renderScreen();

    const row = view.getByRole('button', { name: /Take a photo/ });
    expect(row).toBeEnabled();
    await fireEvent.press(row);

    await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalledTimes(1));
    expect(picker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('disables the photo row and never reaches the native picker without a camera', async () => {
    setScannerSupported(false);
    setCameraAvailable(false);
    const view = await renderScreen();

    const row = view.getByLabelText('Take a photo, This device has no camera');
    expect(row).toBeDisabled();
    expect(view.queryByRole('button', { name: /Take a photo/ })).toBeNull();
    await fireEvent.press(row);

    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: /Choose from Photos/ })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: /Import a file/ })).toBeOnTheScreen();
  });
});

describe('AddDocumentScreen file import', () => {
  const pickerFolder = () => new Directory(Paths.cache, PICKER_DIRECTORY);

  // What the picker hands back with copyToCacheDirectory: a plaintext copy in its cache folder.
  function plantPickedCopy(name = '8F0C2A41-6B3D-4E8A-9F11-2C7D5E0B9A13.jpg') {
    if (!pickerFolder().exists) pickerFolder().create({ intermediates: true });
    const copy = new File(pickerFolder(), name);
    copy.writeSync('plaintext');
    pickDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: copy.uri, name: 'passport.jpg', mimeType: 'image/jpeg', size: 9 }],
    });
    return copy;
  }

  async function importFile() {
    const view = await renderScreen();
    await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    return view;
  }

  afterEach(() => {
    if (pickerFolder().exists) pickerFolder().delete();
    jest.clearAllMocks();
  });

  it("removes iOS's Inbox copy as soon as the picker has made its own", async () => {
    const documents = jest
      .spyOn(Paths, 'document', 'get')
      .mockReturnValue(new Directory('file:///mock/Documents/'));
    const inbox = new Directory(`file:///mock/tmp/${APPLE_INBOX_DIRECTORY}/`);
    inbox.create({ intermediates: true });
    const original = new File(inbox, 'passport.jpg');
    original.writeSync('plaintext');
    try {
      const copy = plantPickedCopy();
      await importFile();

      expect(original.exists).toBe(false);
      expect(copy.exists).toBe(true);
    } finally {
      documents.mockRestore();
      new Directory('file:///mock/tmp/').delete();
    }
  });

  it('removes the picked copy once the document is saved', async () => {
    const copy = plantPickedCopy();
    const view = await importFile();

    await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));

    await waitFor(() => expect(copy.exists).toBe(false));
    expect(await documentService.getAllDocuments()).not.toHaveLength(0);
  });

  it('removes the picked copy when the user goes back to the sources', async () => {
    const copy = plantPickedCopy();
    const view = await importFile();
    expect(copy.exists).toBe(true);

    await fireEvent.press(view.getByLabelText('Back to sources'));

    expect(copy.exists).toBe(false);
    expect(view.getByRole('button', { name: /Import a file/ })).toBeOnTheScreen();
  });

  it('removes the picked copy when the screen closes without saving', async () => {
    const copy = plantPickedCopy();
    const view = await importFile();

    await act(async () => {
      view.unmount();
    });

    expect(copy.exists).toBe(false);
  });

  it('keeps the copy until a save interrupted by closing the screen has encrypted it', async () => {
    const copy = plantPickedCopy();
    let release: () => void = () => {};
    const putFile = jest
      .spyOn(vault, 'putFile')
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
    const before = (await documentService.getAllDocuments()).length;
    const view = await importFile();
    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(putFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.unmount();
    });
    expect(copy.exists).toBe(true);

    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(copy.exists).toBe(false);
    expect(await documentService.getAllDocuments()).toHaveLength(before + 1);
    // The screen is gone; going back would pop whatever is under it.
    expect(router.back).not.toHaveBeenCalled();
    putFile.mockRestore();
  });

  it('removes the copy when a save interrupted by closing the screen fails', async () => {
    const copy = plantPickedCopy();
    let fail: (error: Error) => void = () => {};
    const putFile = jest
      .spyOn(vault, 'putFile')
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (fail = reject)));
    const view = await importFile();
    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      view.unmount();
    });
    await act(async () => {
      fail(new Error('disk full'));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(copy.exists).toBe(false);
    putFile.mockRestore();
  });

  describe('a save the lock interrupts', () => {
    let session: Session;

    beforeEach(() => {
      vaultMock.reset();
      secureStoreMock.__reset();
    });

    afterEach(() => {
      vaultMock.reset();
      secureStoreMock.__reset();
    });

    async function importUnlocked() {
      const view = await renderUnlockedScreen(<AddDocumentScreen />, {
        onSession: (value) => {
          session = value;
        },
      });
      await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));
      await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
      return view;
    }

    it.each([
      ['finishes', { message: 'Saved to your vault', tone: 'success' }],
      ['fails', { message: 'Could not save the document.', tone: 'danger' }],
    ])('reports after the next unlock when it %s as the vault locks', async (outcome, notice) => {
      plantPickedCopy();
      const view = await importUnlocked();
      // The vault locks while the module is still reading the copy; the save
      // settles before the screen behind the gate has gone.
      const putFile = jest.spyOn(vault, 'putFile').mockImplementationOnce(async () => {
        session.lock();
        if (outcome === 'fails') throw 'swept';
      });

      await act(async () => {
        void fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(view.getByText('locked')).toBeOnTheScreen();
      expect(session.notice).toEqual(notice);
      expect(router.back).not.toHaveBeenCalled();
      putFile.mockRestore();
    });
  });

  it('removes a copy the picker hands back after the screen has closed', async () => {
    if (!pickerFolder().exists) pickerFolder().create({ intermediates: true });
    const copy = new File(pickerFolder(), '5A1E9C70-0D2B-4F6E-8C3A-7B4D1E2F3A90.pdf');
    copy.writeSync('plaintext');
    let answer: (value: unknown) => void = () => {};
    pickDocument.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const view = await renderScreen();
    // The press stays open while the picker is up, so it runs outside this act.
    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: /Import a file/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(pickDocument).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.unmount();
    });
    await act(async () => {
      answer({
        canceled: false,
        assets: [{ uri: copy.uri, name: 'lease.pdf', mimeType: 'application/pdf', size: 9 }],
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(copy.exists).toBe(false);
  });
});
