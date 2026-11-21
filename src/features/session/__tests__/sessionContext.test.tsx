import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Profiler, useEffect } from 'react';
import { Text } from 'react-native';

import { secureStoreMock } from '@/testing/secureStore';
import { vaultMock } from '@/testing/vault';

import { useSessionActions, useSessionState } from '../context';
import { SessionProvider } from '../SessionProvider';
import type { SessionActions, SessionState } from '../types';

let actions: SessionActions;
let state: SessionState;
let actionRenders = 0;

function ActionsReader() {
  const value = useSessionActions();
  useEffect(() => {
    actions = value;
  });
  return <Text>actions only</Text>;
}

function StateReader() {
  const value = useSessionState();
  useEffect(() => {
    state = value;
  });
  return <Text testID="status">{value.status}</Text>;
}

function renderSession() {
  return render(
    <SessionProvider>
      <Profiler id="actions" onRender={() => (actionRenders += 1)}>
        <ActionsReader />
      </Profiler>
      <StateReader />
    </SessionProvider>,
  );
}

beforeEach(() => {
  vaultMock.reset();
  secureStoreMock.__reset();
  actionRenders = 0;
});

describe('session contexts', () => {
  it('keeps the actions object when state changes', async () => {
    await renderSession();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('setup'));
    const before = actions;

    await act(async () => actions.postNotice({ message: 'Hello' }));
    await waitFor(() => expect(state.notice).toEqual({ message: 'Hello' }));
    expect(actions).toBe(before);

    await act(async () => {
      expect(await actions.setUp('123456')).toBe(true);
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(actions).toBe(before);

    await act(async () => actions.lock());
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('locked'));
    expect(actions).toBe(before);
  });

  it('does not render an actions-only reader again when state changes', async () => {
    await renderSession();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('setup'));
    const rendersBefore = actionRenders;

    await act(async () => actions.postNotice({ message: 'One' }));
    await waitFor(() => expect(state.notice).toEqual({ message: 'One' }));
    await act(async () => actions.dismissNotice());
    await waitFor(() => expect(state.notice).toBeNull());

    expect(actionRenders).toBe(rendersBefore);
  });

  it('throws outside the provider', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Actions() {
      useSessionActions();
      return null;
    }
    function State() {
      useSessionState();
      return null;
    }
    await expect(render(<Actions />)).rejects.toThrow(
      'useSessionActions must be used inside SessionProvider',
    );
    await expect(render(<State />)).rejects.toThrow(
      'useSessionState must be used inside SessionProvider',
    );
    errors.mockRestore();
  });
});
