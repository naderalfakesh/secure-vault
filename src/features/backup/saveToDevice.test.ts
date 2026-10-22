import { Directory, File, Paths } from 'expo-file-system';

import { isPickerCancel, SAVE_CHUNK_BYTES, saveBackupToDevice } from './saveToDevice';

// The in-memory file system keys created files by their raw name, so no spaces here.
const NAME = 'SecureVault-backup-2026-10-23.svbackup';

function stagedBackup(length: number): { file: File; bytes: Uint8Array } {
  const folder = new Directory(Paths.cache, 'backup');
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, NAME);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) bytes[i] = (i * 31) % 251;
  file.create({ overwrite: true });
  file.write(bytes);
  return { file, bytes };
}

function chosenFolder(): Directory {
  const folder = new Directory(Paths.document, 'chosen-folder');
  if (folder.exists) folder.delete();
  folder.create({ intermediates: true });
  return folder;
}

const cancelled = () =>
  Object.assign(new Error('The file picker was cancelled by the user'), {
    code: 'ERR_PICKER_CANCELLED',
  });

describe('saveBackupToDevice', () => {
  it('copies the encrypted container byte for byte, across several slices', async () => {
    const { file, bytes } = stagedBackup(SAVE_CHUNK_BYTES * 2 + 17);
    const folder = chosenFolder();

    const outcome = await saveBackupToDevice(file.uri, NAME, {
      pick: async () => folder,
      stillCurrent: () => true,
    });

    expect(outcome).toBe('saved');
    const saved = new File(folder, NAME);
    expect(saved.exists).toBe(true);
    expect(saved.bytesSync()).toEqual(bytes);
    // The staged copy is the caller's to remove.
    expect(file.exists).toBe(true);
  });

  it('creates nothing when the picker is cancelled', async () => {
    const { file } = stagedBackup(64);
    const folder = chosenFolder();
    const create = jest.spyOn(Directory.prototype, 'createFile');

    const outcome = await saveBackupToDevice(file.uri, NAME, {
      pick: async () => {
        throw cancelled();
      },
      stillCurrent: () => true,
    });

    expect(outcome).toBe('cancelled');
    expect(create).not.toHaveBeenCalled();
    expect(folder.list()).toHaveLength(0);
    create.mockRestore();
  });

  it('writes nothing when the session ended while the picker was up', async () => {
    const { file } = stagedBackup(64);
    const folder = chosenFolder();

    const outcome = await saveBackupToDevice(file.uri, NAME, {
      pick: async () => folder,
      stillCurrent: () => false,
    });

    expect(outcome).toBe('interrupted');
    expect(folder.list()).toHaveLength(0);
  });

  it('gives up on a picker that is still open when the session ends', async () => {
    const { file } = stagedBackup(64);
    let ended!: () => void;

    const result = saveBackupToDevice(file.uri, NAME, {
      pick: () => new Promise<Directory>(() => {}),
      stillCurrent: () => false,
      ended: new Promise<void>((resolve) => {
        ended = resolve;
      }),
    });
    ended();

    await expect(result).resolves.toBe('interrupted');
  });

  it('removes the partial copy when the session ends mid-copy', async () => {
    const { file } = stagedBackup(SAVE_CHUNK_BYTES * 3);
    const folder = chosenFolder();
    let checks = 0;

    const outcome = await saveBackupToDevice(file.uri, NAME, {
      pick: async () => folder,
      // Current after the picker and for the first slice, then the vault locks.
      stillCurrent: () => {
        checks += 1;
        return checks <= 2;
      },
    });

    expect(outcome).toBe('interrupted');
    expect(new File(folder, NAME).exists).toBe(false);
  });

  it('removes the partial copy and rethrows when writing fails', async () => {
    const { file } = stagedBackup(SAVE_CHUNK_BYTES + 1);
    const folder = chosenFolder();
    const create = jest.spyOn(Directory.prototype, 'createFile');
    create.mockImplementation(function (this: Directory, name: string, mime: string | null) {
      create.mockRestore();
      const target = this.createFile(name, mime);
      const open = target.open.bind(target);
      target.open = (mode) => {
        const handle = open(mode);
        handle.writeBytes = async () => {
          throw new Error('content://com.android.providers/document/42: ENOSPC');
        };
        return handle;
      };
      return target;
    });

    await expect(
      saveBackupToDevice(file.uri, NAME, { pick: async () => folder, stillCurrent: () => true }),
    ).rejects.toThrow(/ENOSPC/);
    expect(new File(folder, NAME).exists).toBe(false);
  });

  it('tells a cancelled picker from other failures', () => {
    expect(isPickerCancel(cancelled())).toBe(true);
    expect(isPickerCancel(new Error('The file picker was cancelled by the user'))).toBe(true);
    expect(isPickerCancel(new Error('No activity'))).toBe(false);
    expect(isPickerCancel(null)).toBe(false);
  });
});
