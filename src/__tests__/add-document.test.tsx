import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import AddDocumentScreen from '../../app/documents/add';
import {
  setCameraAvailable,
  setScannerSupported,
} from '../../modules/expo-document-scanner/src/index.mock';
import { ToastProvider } from '../components/ui';
import { SessionProvider } from '../features/session/SessionProvider';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;

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
