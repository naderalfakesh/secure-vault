// Reexport the native module. On web, it will be resolved to ExpoVaultModule.web.ts
// and on native platforms to ExpoVaultModule.ts
export { default } from './src/ExpoVaultModule';
export type { BiometryType, RenderedPage, SecureVault } from './src/ExpoVaultModule';
export * from './src/ExpoVault.types';
