import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { queueScan } from '@modules/expo-document-scanner/src/index.mock';

import AddDocumentScreen from '../../app/documents/add';
import { ToastProvider } from '../components/ui';
import { scanText } from '../features/scan/scanCopy';
import { SessionProvider } from '../features/session/SessionProvider';
import { PICKER_DIRECTORY, SCANNER_DIRECTORY } from '../services/DocumentService';

export const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
export const pickDocument = DocumentPicker.getDocumentAsync as jest.Mock;
export const scanner = () => new Directory(Paths.cache, SCANNER_DIRECTORY);
export const pickerFolder = () => new Directory(Paths.cache, PICKER_DIRECTORY);

// The save step's own sentence (scan.processing.failed).
export const SAVE_FAILED = scanText('processing.failed');

export const PASSPORT_TEXT = `REPUBLIC OF EXAMPLE
PASSPORT
Passport No: X12344821
Surname: DOE
Date of expiry: 12 MAR 2030`;

export function plant(directory: Directory, name: string) {
  if (!directory.exists) directory.create({ intermediates: true });
  const copy = new File(directory, name);
  copy.writeSync('plaintext');
  return copy;
}

export function plantScan(count: number, start = 1) {
  const pages = Array.from({ length: count }, (_, index) =>
    plant(scanner(), `${1000 + start + index}.jpg`),
  );
  queueScan(pages.map((page) => ({ uri: page.uri, width: 10, height: 10 })));
  return pages;
}

export function renderScreen() {
  return render(
    <SessionProvider>
      <ToastProvider>
        <AddDocumentScreen />
      </ToastProvider>
    </SessionProvider>,
  );
}

export async function scanInto(count: number) {
  const pages = plantScan(count);
  const view = await renderScreen();
  await fireEvent.press(view.getByRole('button', { name: /Scan with the camera/ }));
  await waitFor(() =>
    expect(view.getByText(count === 1 ? '1 page' : `${count} pages`)).toBeOnTheScreen(),
  );
  return { view, pages };
}
