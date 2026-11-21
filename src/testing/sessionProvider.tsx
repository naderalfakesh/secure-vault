import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { SessionProvider } from '@/features/session/SessionProvider';
import type { SecuritySettings } from '@/features/session/settings';
import { useSessionValue, type Session } from '@/testing/session';

export type AutoLockSeconds = SecuritySettings['autoLockSeconds'];

export function Probe() {
  const session = useSessionValue();
  return (
    <>
      <Text testID="status">{session.status}</Text>
      <Text testID="error">{session.error ?? ''}</Text>
      <Text testID="failures">{String(session.lockout.failures)}</Text>
      <Text testID="locked-until">{String(session.lockout.lockedUntil)}</Text>
      <Text testID="autolock">{String(session.settings.autoLockSeconds)}</Text>
      <Text testID="vault-empty">{String(session.vaultEmpty)}</Text>
      <Text onPress={() => void session.changePin('123456', '654321')}>run change pin</Text>
      <Text onPress={() => void session.setUp('123456')}>run setup</Text>
      <Text onPress={() => void session.unlock()}>run unlock</Text>
      <Text onPress={() => void session.unlockWithPin('123456')}>run pin ok</Text>
      <Text onPress={() => void session.unlockWithPin('000000')}>run pin bad</Text>
      <Text onPress={() => void session.updateSettings({ autoLockSeconds: 900 })}>
        run settings
      </Text>
      <Text onPress={session.lock}>run lock</Text>
    </>
  );
}

export function renderProbe() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
}

export let session: Session;
function Capture() {
  const value = useSessionValue();
  useEffect(() => {
    session = value;
  });
  return <Text testID="status">{value.status}</Text>;
}

export async function unlocked(autoLockSeconds: AutoLockSeconds = 0) {
  const view = await render(
    <SessionProvider>
      <Capture />
    </SessionProvider>,
  );
  await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
  await act(async () => {
    await session.setUp('123456');
  });
  await act(async () => {
    await session.updateSettings({ autoLockSeconds });
  });
  expect(view.getByTestId('status')).toHaveTextContent('unlocked');
  return view;
}

export function pending() {
  let settle!: () => void;
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

export const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
