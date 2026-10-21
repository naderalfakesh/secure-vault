import * as SecureStore from 'expo-secure-store';

import { clearLastBackup, loadLastBackup, recordLastBackup } from './lastBackup';

const secureStoreMock = SecureStore as unknown as { __reset(): void };

describe('the last backup made on this phone (F10)', () => {
  beforeEach(() => secureStoreMock.__reset());
  afterEach(() => jest.restoreAllMocks());

  it('is unknown until a backup is recorded, then reads back the day it was made', async () => {
    expect(await loadLastBackup()).toBeNull();

    await recordLastBackup(new Date('2026-10-12T09:30:00Z'));

    expect((await loadLastBackup())?.toISOString()).toBe('2026-10-12T09:30:00.000Z');
  });

  it('stores only the date, outside the vault', async () => {
    const set = jest.spyOn(SecureStore, 'setItemAsync');

    await recordLastBackup(new Date('2026-10-12T09:30:00Z'));

    expect(set).toHaveBeenCalledWith(
      'securevault.lastBackup',
      '2026-10-12T09:30:00.000Z',
      expect.anything(),
    );
  });

  it('treats an unreadable or malformed value as unknown', async () => {
    await SecureStore.setItemAsync('securevault.lastBackup', 'not a date');
    expect(await loadLastBackup()).toBeNull();

    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('refused'));
    expect(await loadLastBackup()).toBeNull();
  });

  it('never fails the export when the date cannot be written, and is cleared with the vault', async () => {
    jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(new Error('refused'));
    await expect(recordLastBackup()).resolves.toBeUndefined();

    await recordLastBackup(new Date('2026-10-12T09:30:00Z'));
    await clearLastBackup();
    expect(await loadLastBackup()).toBeNull();
  });
});
