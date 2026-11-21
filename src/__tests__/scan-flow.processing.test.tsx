import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import {
  pickDocument,
  scanner,
  pickerFolder,
  SAVE_FAILED,
  PASSPORT_TEXT,
  plant,
  renderScreen,
  scanInto,
} from '@/testing/scanFlow';
import {
  queueScan,
  setCameraAvailable,
  setScannerSupported,
} from '@modules/expo-document-scanner/src/index.mock';
import vault from '@modules/expo-vault';

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
    // iOS reads with Apple Vision, so no Google ML Kit notice here (ADR 0011).
    expect(view.queryByText(/ML Kit|Google/)).toBeNull();
    expect(
      view.getByText(
        'Text is read on this device by Apple’s Vision framework, which is part of iOS.',
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

  it('shows its own sentence, never the native rejection, when the vault refuses a page', async () => {
    jest
      .spyOn(vault, 'putFile')
      .mockRejectedValueOnce(
        new Error(
          "Call to function 'ExpoVault.putFile' has been rejected. → Caused by: java.lang.IllegalStateException: closed",
        ),
      );
    const { view } = await scanInto(1);
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(view.getByLabelText('Title')).toBeOnTheScreen());

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save to vault' }));
    });

    await waitFor(() => expect(view.getByRole('alert')).toBeOnTheScreen());
    expect(within(view.getByRole('alert')).getByText(SAVE_FAILED)).toBeOnTheScreen();
    expect(view.queryByText(/ExpoVault|java\.lang|rejected|Caused by/)).toBeNull();
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
    expect(view.getByLabelText('Title').props.value).toBe('Republic of Example');
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
