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
