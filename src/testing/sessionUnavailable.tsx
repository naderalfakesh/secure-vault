import { render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Text } from 'react-native';

import { SessionProvider } from '@/features/session/SessionProvider';
import { hashPasscode } from '@/testing/passcode';
import { useSessionValue } from '@/testing/session';
import vault from '@modules/expo-vault';

export const PIN_ENTRY = 'securevault.pin';

function UnavailableProbe() {
  const session = useSessionValue();
  return (
    <>
      <Text testID="status">{session.status}</Text>
      <Text testID="error">{session.error ?? ''}</Text>
      <Text testID="failures">{String(session.lockout.failures)}</Text>
      <Text testID="held">{String(session.setupHeld)}</Text>
      <Text testID="pin-lost">{String(session.pinLost)}</Text>
      <Text testID="key-invalidated">{String(session.keyInvalidated)}</Text>
      <Text testID="locked-until">{String(session.lockout.lockedUntil)}</Text>
      <Text onPress={() => void session.resetLostPin()}>run reset pin</Text>
      <Text onPress={() => void session.retry()}>run retry</Text>
      <Text onPress={() => void session.setUp('123456')}>run setup</Text>
      <Text onPress={() => void session.setUp('123456', { holdForOnboarding: true })}>
        run held setup
      </Text>
      <Text onPress={session.finishSetup}>run finish</Text>
      <Text onPress={() => void session.unlockWithPin('123456')}>run pin ok</Text>
      <Text onPress={() => void session.eraseVault()}>run erase</Text>
    </>
  );
}

export const renderUnavailableProbe = () =>
  render(
    <SessionProvider>
      <UnavailableProbe />
    </SessionProvider>,
  );

export async function seedLockedVault() {
  await vault.createVault();
  await vault.put('_key_probe', 'ok');
  await SecureStore.setItemAsync(PIN_ENTRY, hashPasscode('123456', { iterations: 64 }));
}

/** Makes the secure store refuse to read the PIN record until `restore` is called. */
export function failPinReads() {
  const getItem = SecureStore.getItemAsync;
  return jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (key, options) => {
    if (key === PIN_ENTRY) throw new Error('User interaction is not allowed.');
    return getItem(key, options);
  });
}

export const keyReadFailure = () =>
  Object.assign(new Error('KeyStore load failed'), { code: 'HAS_VAULT_FAILED' });
