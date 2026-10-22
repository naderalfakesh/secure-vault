import { Directory, File, FileMode } from 'expo-file-system';

/** How a save to the device ended; failures throw. */
export type SaveOutcome = 'saved' | 'cancelled' | 'interrupted';

// Read and written in slices, so a large backup never sits in memory whole.
export const SAVE_CHUNK_BYTES = 1024 * 1024;

export type SaveOptions = {
  /** Opens the system picker; resolves with where the user chose to save. */
  pick?: () => Promise<Directory>;
  /** Waited on around the picker, e.g. to pause auto-lock while it is up. */
  aroundPicker?: (work: () => Promise<Directory>) => Promise<Directory>;
  /** False once the session that asked for the save has ended. */
  stillCurrent: () => boolean;
  /** Settles when that session ends; a picker still open then is given up on. */
  ended?: Promise<unknown>;
};

/** Whether the system picker was closed without a choice (expo-file-system's `PickerCancelledException`). */
export function isPickerCancel(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === 'ERR_PICKER_CANCELLED') return true;
  return typeof message === 'string' && /picker was cancel/i.test(message);
}

function removeQuietly(file: File | null): void {
  try {
    if (file?.exists) file.delete();
  } catch {
    // A half-written copy is ciphertext without its end; it cannot be restored.
  }
}

/**
 * Saves a finished backup container outside the app (Android), through the
 * Storage Access Framework folder picker that expo-file-system provides: the
 * user picks a folder, a document of the backup's name is created there and
 * the container's bytes are copied into it as they are, so what lands on the
 * device is the same encrypted file the share sheet hands out. The staged
 * container itself is the caller's to remove.
 *
 * Nothing is created when the picker is cancelled or the session ended while
 * it was up. A copy the session ends during, or one that fails, is removed
 * again, so no partial file is left in the chosen folder.
 */
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
    // A picker the session ended during may still settle later; nothing waits on it.
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
    } catch {
      // Closed or never opened.
    }
    writer = null;
    removeQuietly(target);
    throw error;
  } finally {
    try {
      writer?.close();
      reader?.close();
    } catch {
      // Released with the process at the latest.
    }
  }
}
