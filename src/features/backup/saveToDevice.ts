import { Directory, File, FileMode } from 'expo-file-system';

import { errorCode } from '@/utils/errors';

type SaveOutcome = 'saved' | 'cancelled' | 'interrupted';

export const SAVE_CHUNK_BYTES = 1024 * 1024;

type SaveOptions = {
  pick?: () => Promise<Directory>;
  aroundPicker?: (work: () => Promise<Directory>) => Promise<Directory>;
  stillCurrent: () => boolean;
  ended?: Promise<unknown>;
};

export function isPickerCancel(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (errorCode(error) === 'ERR_PICKER_CANCELLED') return true;
  const { message } = error as { message?: unknown };
  return typeof message === 'string' && /picker was cancel/i.test(message);
}

function removeQuietly(file: File | null): void {
  try {
    if (file?.exists) file.delete();
  } catch {}
}

export async function saveBackupToDevice(
  sourceUri: string,
  name: string,
  {
    pick = () => Directory.pickDirectoryAsync(),
    aroundPicker = (work) => work(),
    stillCurrent,
    ended,
  }: SaveOptions,
): Promise<SaveOutcome> {
  let folder: Directory | null;
  try {
    const picked = aroundPicker(pick);
    // Avoid unhandled rejection if the picker settles after the session ends.
    picked.catch(() => {});
    folder = await (ended ? Promise.race([picked, ended.then(() => null)]) : picked);
  } catch (error) {
    if (isPickerCancel(error)) return 'cancelled';
    throw error;
  }
  if (!folder || !stillCurrent()) return 'interrupted';

  let target: File | null = null;
  let reader: ReturnType<File['open']> | null = null;
  let writer: ReturnType<File['open']> | null = null;
  try {
    target = folder.createFile(name, 'application/octet-stream');
    reader = new File(sourceUri).open(FileMode.ReadOnly);
    writer = target.open(FileMode.Truncate);
    for (;;) {
      if (!stillCurrent()) {
        writer.close();
        writer = null;
        removeQuietly(target);
        return 'interrupted';
      }
      const chunk = await reader.readBytes(SAVE_CHUNK_BYTES);
      if (chunk.length === 0) break;
      await writer.writeBytes(chunk);
    }
    writer.close();
    writer = null;
    return 'saved';
  } catch (error) {
    try {
      writer?.close();
    } catch {}
    writer = null;
    removeQuietly(target);
    throw error;
  } finally {
    try {
      writer?.close();
      reader?.close();
    } catch {}
  }
}
