const { jest } = require('@jest/globals');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Unistyles ships a Jest mock for its Nitro runtime; the theme config must be
// loaded after it so StyleSheet.configure registers the app themes.
require('react-native-unistyles/mocks');
require('./src/theme/unistyles');

// The vault is a local Expo module with no JS fallback, so every test starts
// from an in-memory fake that mirrors the native API surface.
jest.mock('./modules/expo-vault', () => require('./modules/expo-vault/src/ExpoVaultModule.mock'));

jest.mock('expo-device', () => ({ isDevice: true }));

// Hooks that need a SafeAreaProvider get fixed zero insets in tests; the
// SafeAreaView component itself renders fine without a provider.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    ...actual,
    useSafeAreaInsets: () => zero,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock('react-native-reanimated', () => {
  const reanimatedMock = require('react-native-reanimated/mock');
  return { ...reanimatedMock, useReducedMotion: () => false };
});
