import { render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Dimensions } from 'react-native';

import ChangePinScreen from '../../app/settings/change-pin';
import LockScreen from '../../app/lock';
import CreatePinScreen from '../../app/setup/pin';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { pinPadMetrics } from '../components/ui/PinPad';
import { hashPasscode } from '@/testing/passcode';
import { SessionProvider } from '../features/session/SessionProvider';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}));

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void; unlockWithBiometrics(): Promise<boolean> };

/** Status bar plus navigation bar on a gesture-navigation phone. */
const SYSTEM_BARS = 48;
/** The lock footer: the 52 pt device-unlock button and its margins. */
const FOOTER = { compact: 52 + 16, regular: 52 + 44 };
/** Mark, title, one-line subtitle, dots, and their spacing at the default text size. */
const HEADER = {
  compact: 24 + 64 + 12 + 28 + 6 + 20 + 24 + 14 + 16,
  regular: 56 + 64 + 12 + 28 + 6 + 20 + 36 + 14 + 16,
};

function setWindow(width: number, height: number, fontScale = 1) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height, scale: 2.625, fontScale });
}

describe('PIN screens on short windows (M3)', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([568, 600, 640, 648, 700, 740, 780, 844, 932])(
    'leaves room for the lock header above the keypad at %i pt',
    (height) => {
      const { key, rowGap, compact } = pinPadMetrics(height);
      const pad = key * 4 + rowGap * 3;
      const header = compact ? HEADER.compact : HEADER.regular;
      const footer = compact ? FOOTER.compact : FOOTER.regular;
      expect(key).toBeGreaterThanOrEqual(44);
      expect(SYSTEM_BARS + header + pad + footer).toBeLessThanOrEqual(height);
    },
  );

  it('keeps the design keypad on a regular phone', () => {
    expect(pinPadMetrics(844)).toEqual({ key: 76, rowGap: 16, columnGap: 26, compact: false });
  });

  it('shrinks the lock keypad and lets the header scroll at 411 × 648 dp', async () => {
    setWindow(411, 648);
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    jest.spyOn(vaultMock, 'unlockWithBiometrics').mockResolvedValue(false);
    const view = await render(
      <SessionProvider>
        <LockScreen />
      </SessionProvider>,
    );
    await waitFor(() => expect(view.getByText('SecureVault is locked')).toBeOnTheScreen());

    expect(view.getByRole('button', { name: '5' })).toHaveStyle({ width: 60, height: 60 });
    const header = view.getByTestId('lock-header');
    expect(header.type).toBe('RCTScrollView');
    // The title and subtitle sit in the scrollable header, not under the pad;
    // the dots sit below it, outside the scroll, so they never scroll away (AX5).
    expect(header).toContainElement(view.getByText('SecureVault is locked'));
    expect(header).not.toContainElement(view.getByLabelText('0 of 6 digits entered'));
    expect(view.getByTestId('lock-dots')).toContainElement(
      view.getByLabelText('0 of 6 digits entered'),
    );
  });

  it('shrinks the setup keypad at 411 × 648 dp', async () => {
    setWindow(411, 648);
    const view = await render(
      <SessionProvider>
        <CreatePinScreen />
      </SessionProvider>,
    );
    await waitFor(() => expect(view.getByRole('button', { name: '5' })).toBeOnTheScreen());
    expect(view.getByRole('button', { name: '5' })).toHaveStyle({ width: 60, height: 60 });
    expect(view.getByTestId('pin-header')).toContainElement(
      view.getByLabelText('0 of 6 digits entered'),
    );
  });

  it('shrinks the Change PIN keypad at 411 × 648 dp', async () => {
    setWindow(411, 648);
    const view = await render(
      <SessionProvider>
        <ToastProvider>
          <ChangePinScreen />
        </ToastProvider>
      </SessionProvider>,
    );
    await waitFor(() => expect(view.getByRole('button', { name: '5' })).toBeOnTheScreen());
    expect(view.getByRole('button', { name: '5' })).toHaveStyle({ width: 60, height: 60 });
    expect(view.getByTestId('pin-header')).toContainElement(
      view.getByLabelText('0 of 6 digits entered'),
    );
  });
});
