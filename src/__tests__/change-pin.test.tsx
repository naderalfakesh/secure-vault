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
  // A wrong entry flashes before the dots clear; digits typed meanwhile are dropped.
  await waitFor(() => expect(view.getByLabelText('0 of 6 digits entered')).toBeOnTheScreen(), {
    timeout: 3000,
  });
  for (const digit of pin) await fireEvent.press(view.getByRole('button', { name: digit }));
}

const shows = (view: Awaited<ReturnType<typeof renderScreen>>, text: string) =>
  waitFor(() => expect(view.getByText(text)).toBeOnTheScreen(), { timeout: 3000 });

async function storedPinIs(pin: string) {
  const record = await sessionStorage.loadPinRecord();
  return record !== null && verifyPasscodeAsync(pin, record);
}

// Each PIN check runs the real key stretching, so these tests take a few seconds.
jest.setTimeout(30_000);

describe('Change PIN', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    (router.back as jest.Mock).mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('walks the three steps and refuses the same PIN and a mismatch inline', async () => {
    const view = await renderScreen();

    await enter(view, '123456');
    await shows(view, 'Step 2 of 3');
    expect(
      view.getByText('Your documents aren’t touched. Only the way in changes.'),
    ).toBeOnTheScreen();

    await enter(view, '123456');
    await shows(view, 'Choose a PIN that’s different from your current one.');

    await enter(view, '654321');
    await shows(view, 'Step 3 of 3');
    await enter(view, '111111');
    await shows(view, 'The PINs didn’t match. Start again.');
    await shows(view, 'Step 2 of 3');

    await enter(view, '654321');
    await shows(view, 'Step 3 of 3');
    await enter(view, '654321');

    await shows(view, 'PIN changed');
    expect(router.back).toHaveBeenCalled();
    expect(await storedPinIs('654321')).toBe(true);
  });

  it('changes nothing when the current PIN was wrong', async () => {
    const view = await renderScreen();

    await enter(view, '000000');
    await shows(view, 'Step 2 of 3');
    await enter(view, '654321');
    await shows(view, 'Step 3 of 3');
    await enter(view, '654321');

    await shows(view, 'Wrong PIN. Nothing was changed.');
    expect(view.getByText('Step 1 of 3')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(await storedPinIs('123456')).toBe(true);
  });

  it('says the PIN was not changed, not that it was wrong, when the key prompt ends key-locked', async () => {
    const view = await renderScreen();
    const save = jest
      .spyOn(SecureStore, 'setItemAsync')
      .mockRejectedValue(
        Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' }),
      );

    await enter(view, '123456');
    await shows(view, 'Step 2 of 3');
    await enter(view, '654321');
    await shows(view, 'Step 3 of 3');
    await enter(view, '654321');

    await shows(view, 'The device key was not unlocked, so the PIN was not changed. Try again.');
    expect(view.queryByText(/Wrong PIN/)).toBeNull();
    expect(view.getByText('Step 1 of 3')).toBeOnTheScreen();
    save.mockRestore();
    expect(await storedPinIs('123456')).toBe(true);
  });

  it('counts wrong current PINs towards the lock screen lockout, and the device unlock still works', async () => {
    const view = await renderScreen();

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await act(async () => {
        await expect(session.changePin('000000', '654321')).resolves.toBe('wrong-pin');
      });
    }
    expect(session.lockout.failures).toBe(4);
    expect((await sessionStorage.loadLockout())?.failures).toBe(4);

    // The fifth wrong PIN pauses the keypad, here and on the lock screen.
    await act(async () => {
      await expect(session.changePin('000000', '654321')).resolves.toBe('wrong-pin');
    });
    expect(session.lockout.lockedUntil).toBeGreaterThan(Date.now());
    expect((await sessionStorage.loadLockout())?.lockedUntil).toBeGreaterThan(Date.now());
    await shows(view, 'Try again in 0:30');

    // While paused, not even the right PIN is checked.
    await act(async () => {
      await expect(session.changePin('123456', '654321')).resolves.toBe('locked-out');
    });
    expect(await storedPinIs('123456')).toBe(true);

    // The device key's own gate still opens the vault and ends the pause.
    await act(async () => {
      await expect(session.unlock()).resolves.toBe(true);
    });
    expect(session.lockout).toEqual({ failures: 0, lockedUntil: 0 });
    await act(async () => {
      await expect(session.changePin('123456', '654321')).resolves.toBe('changed');
    });
    expect(await storedPinIs('654321')).toBe(true);
  });

  it('resets the count after the right current PIN', async () => {
    await renderScreen();
    await act(async () => {
      await session.changePin('000000', '654321');
      await session.changePin('000000', '654321');
    });
    expect(session.lockout.failures).toBe(2);

    await act(async () => {
      await expect(session.changePin('123456', '654321')).resolves.toBe('changed');
    });
    expect(session.lockout).toEqual({ failures: 0, lockedUntil: 0 });
    expect((await sessionStorage.loadLockout())?.failures).toBe(0);
  });

  it('leaves with Cancel at any step', async () => {
    const view = await renderScreen();

    await enter(view, '123456');
    await shows(view, 'Step 2 of 3');
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));

    expect(router.back).toHaveBeenCalled();
    expect(await storedPinIs('123456')).toBe(true);
  });
});
