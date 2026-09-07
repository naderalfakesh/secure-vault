import type { SecureVault } from './ExpoVaultModule';

/**
 * In-memory stand-in for the native vault, used by Jest. It keeps the same
 * promise-based surface so services and hooks run unchanged in tests.
 */
export function createVaultMock(): SecureVault & { reset(): void } {
  let strings = new Map<string, string>();
  let files = new Map<string, string>();
  let created = false;

  return {
    async hasVault() {
      return created;
    },
    async biometryType() {
      return 'faceId' as const;
    },
    async createVault() {
      created = true;
    },
    async unlockWithBiometrics() {
      return true;
    },
    async put(key, value) {
      strings.set(key, value);
    },
    async get(key) {
      const value = strings.get(key);
      if (value === undefined) throw new Error(`GET_FAILED: ${key}`);
      return value;
    },
    async delete(key) {
      strings.delete(key);
    },
    async getAllKeys() {
      return [...strings.keys(), ...files.keys()];
    },
    async putFile(key, sourcePath) {
      files.set(key, sourcePath);
    },
    async putThumbnail(key, sourcePath) {
      files.set(key, sourcePath);
    },
    async getFile(key, destPath) {
      if (!files.has(key)) throw new Error(`GET_FILE_FAILED: ${key}`);
      return destPath;
    },
    async deleteFile(key) {
      files.delete(key);
    },
    async getFileSize(key) {
      if (!files.has(key)) throw new Error(`FILE_NOT_FOUND: ${key}`);
      return 1024;
    },
    async exportEncrypted() {
      return JSON.stringify(Object.fromEntries(strings));
    },
    async importEncrypted(json) {
      strings = new Map(Object.entries(JSON.parse(json) as Record<string, string>));
      files = new Map();
    },
    reset() {
      strings = new Map();
      files = new Map();
      created = false;
    },
  };
}

const vaultMock = createVaultMock();

export default vaultMock;
