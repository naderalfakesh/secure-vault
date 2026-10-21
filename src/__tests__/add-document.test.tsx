import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';

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
  IMAGE_PICKER_DIRECTORY,
  PICKER_DIRECTORY,
  SCANNER_DIRECTORY,
} from '../services/DocumentService';

jest.mock('expo-image-picker', () => ({
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

  it('offers the platform scanner when it is supported', async () => {
    setScannerSupported(true);
    setCameraAvailable(true);
    const view = await renderScreen();

    expect(view.getByRole('button', { name: /Scan with the camera/ })).toBeOnTheScreen();
    expect(view.queryByText('Take a photo')).toBeNull();
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

    const row = view.getByLabelText('Take a photo, No camera on this device');
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
    let session: ReturnType<typeof useSession>;

    beforeEach(() => {
      (vault as unknown as { reset(): void }).reset();
      (SecureStore as unknown as { __reset(): void }).__reset();
    });

    afterEach(() => {
      (vault as unknown as { reset(): void }).reset();
      (SecureStore as unknown as { __reset(): void }).__reset();
    });

    // The lock gate as the root layout applies it: no add screen while locked.
    function Gate() {
      const value = useSession();
      useEffect(() => {
        session = value;
      });
      return value.status === 'unlocked' ? <AddDocumentScreen /> : <Text>{value.status}</Text>;
    }

    async function importUnlocked() {
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

describe('AddDocumentScreen photo and scan copies', () => {
  const imagePicker = () => new Directory(Paths.cache, IMAGE_PICKER_DIRECTORY);
  const scanner = () => new Directory(Paths.cache, SCANNER_DIRECTORY);

  function plant(directory: Directory, name: string) {
    if (!directory.exists) directory.create({ intermediates: true });
    const copy = new File(directory, name);
    copy.writeSync('plaintext');
    return copy;
  }

  afterEach(() => {
    for (const directory of [imagePicker(), scanner()]) {
      if (directory.exists) directory.delete();
    }
    queueScan([]);
    jest.clearAllMocks();
  });

  it('removes scanned pages when the user goes back to the sources', async () => {
    const pages = [plant(scanner(), '1001.jpg'), plant(scanner(), '1002.jpg')];
    queueScan(pages.map((page) => ({ uri: page.uri, width: 10, height: 10 })));
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Back to sources'));

    expect(pages.map((page) => page.exists)).toEqual([false, false]);
  });

  it('removes a photo the library hands back after the screen has closed', async () => {
    const photo = plant(imagePicker(), '8F0C2A41-6B3D-4E8A-9F11-2C7D5E0B9A13.jpg');
    let answer: (value: unknown) => void = () => {};
    picker.launchImageLibraryAsync.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)) as never,
    );
    const view = await renderScreen();
    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: /Choose from Photos/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.unmount();
    });
    await act(async () => {
      answer({ canceled: false, assets: [{ uri: photo.uri, fileName: 'IMG_1.jpg' }] });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(photo.exists).toBe(false);
  });
});

describe('AddDocumentScreen pdf previews', () => {
  const pickerFolder = () => new Directory(Paths.cache, PICKER_DIRECTORY);
  let rendered: File[] = [];
  let render_: jest.SpyInstance;

  beforeEach(() => {
    rendered = [];
    // Render a real file so the test can see whether it is removed.
    render_ = jest.spyOn(vault, 'renderPdfPages').mockImplementation(async (_source, _max, dir) => {
      const folder = new Directory(`file://${dir}`);
      folder.create({ intermediates: true });
      const page = new File(folder, 'page_1.jpg');
      page.writeSync('jpeg');
      rendered.push(page);
      return [{ uri: page.uri, width: 10, height: 10 }];
    });
  });

  afterEach(() => {
    render_.mockRestore();
    for (const page of rendered) {
      if (page.parentDirectory.exists) page.parentDirectory.delete();
    }
    if (pickerFolder().exists) pickerFolder().delete();
    jest.clearAllMocks();
  });

  function queuePdf() {
    if (!pickerFolder().exists) pickerFolder().create({ intermediates: true });
    const copy = new File(pickerFolder(), '5A1E9C70-0D2B-4F6E-8C3A-7B4D1E2F3A90.pdf');
    copy.writeSync('plaintext');
    return {
      canceled: false,
      assets: [{ uri: copy.uri, name: 'lease.pdf', mimeType: 'application/pdf', size: 9 }],
    };
  }

  async function importPdf() {
    pickDocument.mockResolvedValueOnce(queuePdf());
    const view = await renderScreen();
    await fireEvent.press(view.getByRole('button', { name: /Import a file/ }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    expect(rendered).toHaveLength(1);
    expect(rendered[0]?.exists).toBe(true);
    return view;
  }

  it('removes the rendered preview when the user goes back to the sources', async () => {
    const view = await importPdf();

    await fireEvent.press(view.getByLabelText('Back to sources'));

    expect(rendered[0]?.parentDirectory.exists).toBe(false);
  });

  it('removes the rendered preview when the screen closes', async () => {
    const view = await importPdf();

    await act(async () => {
      view.unmount();
    });

    expect(rendered[0]?.parentDirectory.exists).toBe(false);
  });

  it('removes a preview rendered for a file picked after the screen closed', async () => {
    let answer: (value: unknown) => void = () => {};
    pickDocument.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const view = await renderScreen();
    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: /Import a file/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    await act(async () => {
      view.unmount();
    });
    await act(async () => {
      answer(queuePdf());
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(rendered).toHaveLength(1);
    expect(rendered[0]?.parentDirectory.exists).toBe(false);
  });
});
