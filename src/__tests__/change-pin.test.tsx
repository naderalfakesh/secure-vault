import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Text } from 'react-native';

import ChangePinScreen from '../../app/settings/change-pin';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { verifyPasscodeAsync } from '../features/auth/passcode';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import { sessionStorage } from '../features/session/settings';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}));

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };

let session: ReturnType<typeof useSession>;

function Gate() {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  return value.status === 'unlocked' ? <ChangePinScreen /> : <Text>{value.status}</Text>;
}

async function renderScreen() {
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
  await waitFor(() => expect(view.getByText('Step 1 of 3')).toBeOnTheScreen());
  return view;
}

async function enter(view: Awaited<ReturnType<typeof renderScreen>>, pin: string) {
  for (const digit of pin) await fireEvent.press(view.getByRole('button', { name: digit }));
  // The keypad submits a beat after the sixth digit, and a wrong entry flashes.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
  });
}

async function storedPinIs(pin: string) {
  const record = await sessionStorage.loadPinRecord();
  return record !== null && verifyPasscodeAsync(pin, record);
}

describe('Change PIN', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    (router.back as jest.Mock).mockClear();
  });

  it('walks the three steps and refuses the same PIN and a mismatch inline', async () => {
    const view = await renderScreen();

    await enter(view, '123456');
    expect(view.getByText('Step 2 of 3')).toBeOnTheScreen();
    expect(
      view.getByText('Your documents aren’t touched. Only the way in changes.'),
    ).toBeOnTheScreen();

    await enter(view, '123456');
    expect(
      view.getByText('Choose a PIN that’s different from your current one.'),
    ).toBeOnTheScreen();

    await enter(view, '654321');
    expect(view.getByText('Step 3 of 3')).toBeOnTheScreen();
    await enter(view, '111111');
    expect(view.getByText('The PINs didn’t match. Start again.')).toBeOnTheScreen();
    expect(view.getByText('Step 2 of 3')).toBeOnTheScreen();

    await enter(view, '654321');
    await enter(view, '654321');

    await waitFor(() => expect(view.getByText('PIN changed')).toBeOnTheScreen());
    expect(router.back).toHaveBeenCalled();
    expect(await storedPinIs('654321')).toBe(true);
  });

  it('changes nothing when the current PIN was wrong', async () => {
    const view = await renderScreen();

    await enter(view, '000000');
    await enter(view, '654321');
    await enter(view, '654321');

    await waitFor(() =>
      expect(view.getByText('Wrong PIN. Nothing was changed.')).toBeOnTheScreen(),
    );
    expect(view.getByText('Step 1 of 3')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(await storedPinIs('123456')).toBe(true);
  });

  it('leaves with Cancel at any step', async () => {
    const view = await renderScreen();

    await enter(view, '123456');
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));

    expect(router.back).toHaveBeenCalled();
    expect(await storedPinIs('123456')).toBe(true);
  });
});
