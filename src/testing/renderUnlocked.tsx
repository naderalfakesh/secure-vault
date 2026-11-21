import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/features/session/SessionProvider';

import { type Session, useSessionValue } from './session';

export type { Session };

interface RenderUnlockedOptions {
  /** Called on every render with the live session, so a test can lock or change it. */
  onSession?: (session: Session) => void;
  /** Wraps the tree the way screens that use gestures are hosted. */
  gestureRoot?: boolean;
  /** Rendered next to the screen, inside the same providers. */
  beside?: ReactNode;
}

// The lock gate as the root layout applies it: no screen while the vault is not unlocked.
function UnlockGate({
  screen,
  onSession,
}: {
  screen: ReactElement;
  onSession: (session: Session) => void;
}) {
  const value = useSessionValue();
  useEffect(() => {
    onSession(value);
  });
  return value.status === 'unlocked' ? screen : <Text>{value.status}</Text>;
}

/** Renders `screen` behind the lock gate, sets up the PIN `123456` and returns once unlocked. */
export async function renderUnlockedScreen(
  screen: ReactElement,
  { onSession, gestureRoot = false, beside }: RenderUnlockedOptions = {},
) {
  let latest: Session | undefined;
  const capture = (value: Session) => {
    latest = value;
    onSession?.(value);
  };
  const tree = (
    <SessionProvider>
      <ToastProvider>
        <UnlockGate screen={screen} onSession={capture} />
        {beside}
      </ToastProvider>
    </SessionProvider>
  );
  const view = await render(
    gestureRoot ? <GestureHandlerRootView>{tree}</GestureHandlerRootView> : tree,
  );
  await waitFor(() => expect(view.getByText('setup')).toBeOnTheScreen());
  if (!latest) throw new Error('The session was not rendered');
  const session = latest;
  await act(async () => {
    await session.setUp('123456');
  });
  return view;
}
