const { jest } = require('@jest/globals');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The vault is a local Expo module with no JS fallback, so every test starts
// from an in-memory fake that mirrors the native API surface.
jest.mock('./modules/expo-vault', () => require('./modules/expo-vault/src/ExpoVaultModule.mock'));

jest.mock('expo-device', () => ({ isDevice: true }));
