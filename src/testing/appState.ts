import { act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

// jest-expo's AppState is a plain object whose `addEventListener` is a mock, but
// the real module's type does not say so, hence the one cast.
export const appState = AppState as unknown as {
  currentState: AppStateStatus;
  addEventListener: jest.Mock;
};

export const appStateListeners = new Set<(state: AppStateStatus) => void>();

/** Starts a test in the foreground with no listeners, and records the ones the code under test adds. */
export function resetAppState() {
  appStateListeners.clear();
  appState.currentState = 'active';
  appState.addEventListener.mockImplementation(
    (_event: string, listener: (state: AppStateStatus) => void) => {
      appStateListeners.add(listener);
      return { remove: () => appStateListeners.delete(listener) };
    },
  );
}

/** For callers that are already inside an `act` scope, such as mocked work run by a press. */
export function setAppState(state: AppStateStatus) {
  appState.currentState = state;
  for (const listener of [...appStateListeners]) listener(state);
}

/** Moves the app to `state` and lets React settle. */
export const moveAppStateTo = (state: AppStateStatus) =>
  act(async () => {
    setAppState(state);
  });
