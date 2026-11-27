import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/features/session/SessionProvider';
import {
  IMAGE_PICKER_DIRECTORY,
  PICKER_DIRECTORY,
  SCANNER_DIRECTORY,
} from '@/services/DocumentService';
import { plantPlaintext } from '@/testing/importResidue';
import { queueScan } from '@modules/expo-document-scanner/src/index.mock';
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

describe('AddDocumentScreen photo and scan copies', () => {
  const imagePicker = () => new Directory(Paths.cache, IMAGE_PICKER_DIRECTORY);
  const scanner = () => new Directory(Paths.cache, SCANNER_DIRECTORY);

  afterEach(() => {
    for (const directory of [imagePicker(), scanner()]) {
      if (directory.exists) directory.delete();
    }
    queueScan([]);
    jest.clearAllMocks();
  });

  it('removes scanned pages when the user goes back to the pages and discards them', async () => {
    const pages = [plantPlaintext(scanner(), '1001.jpg'), plantPlaintext(scanner(), '1002.jpg')];
    queueScan(pages.map((page) => ({ uri: page.uri, width: 10, height: 10 })));
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Continue' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    await fireEvent.press(view.getByLabelText('Back to pages'));
    expect(pages.map((page) => page.exists)).toEqual([true, true]);
    await fireEvent.press(view.getByRole('button', { name: 'Discard' }));

    expect(pages.map((page) => page.exists)).toEqual([false, false]);
  });

  it('removes scanned pages when the screen closes on the details', async () => {
    const pages = [plantPlaintext(scanner(), '1001.jpg')];
    queueScan(pages.map((page) => ({ uri: page.uri, width: 10, height: 10 })));
    const view = await renderScreen();

    await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Continue' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());
    await act(async () => {
      view.unmount();
    });

    expect(pages[0]?.exists).toBe(false);
  });

  it('removes a photo the library hands back after the screen has closed', async () => {
    const photo = plantPlaintext(imagePicker(), '8F0C2A41-6B3D-4E8A-9F11-2C7D5E0B9A13.jpg');
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
