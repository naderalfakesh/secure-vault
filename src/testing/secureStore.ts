import * as SecureStore from 'expo-secure-store';

interface SecureStoreMock {
  /** Empties the in-memory store that `jest.setup.js` installs. */
  __reset(): void;
}

// Jest replaces expo-secure-store with an in-memory store (jest.setup.js) whose
// reset hook is not part of the real module's type, hence the one cast.
export const secureStoreMock = SecureStore as unknown as SecureStoreMock;
