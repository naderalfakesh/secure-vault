import vault from '@modules/expo-vault';

export const keyLocked = () =>
  Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' });

export const keyInvalidated = () =>
  Object.assign(new Error('Key permanently invalidated'), { code: 'KEY_INVALIDATED' });

export const getFailed = () =>
  Object.assign(new Error('Input/output error'), { code: 'GET_FAILED' });

/** Makes `vault.get(entry)` reject with `error()` while forwarding every other key. */
export function failVaultGet(entry: string, error: () => Error) {
  const get = vault.get.bind(vault);
  return jest
    .spyOn(vault, 'get')
    .mockImplementation((key) => (key === entry ? Promise.reject(error()) : get(key)));
}
