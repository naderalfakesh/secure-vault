import { File, FileMode } from 'expo-file-system';

// The trailer that names an encryption dictionary sits at the end of a PDF,
// or at the start of a linearised one; neither needs more than this.
const WINDOW_BYTES = 64 * 1024;
const ENCRYPT_ENTRY = /\/Encrypt[\s/<\d]/;

function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return text;
}

/**
 * Whether a PDF the platform could not render is encrypted, which for an
 * import means it asks for a password: its trailer has an `/Encrypt` entry.
 * Only the first and last 64 KB are read. Any read failure answers false, so
 * the caller falls back to its general sentence.
 */
export async function isEncryptedPdf(uri: string): Promise<boolean> {
  let handle: ReturnType<File['open']> | null = null;
  try {
    handle = new File(uri).open(FileMode.ReadOnly);
    const size = handle.size ?? 0;
    const head = await handle.readBytes(Math.min(size, WINDOW_BYTES));
    if (ENCRYPT_ENTRY.test(latin1(head))) return true;
    if (size <= WINDOW_BYTES) return false;
    handle.offset = Math.max(WINDOW_BYTES, size - WINDOW_BYTES);
    const tail = await handle.readBytes(WINDOW_BYTES);
    return ENCRYPT_ENTRY.test(latin1(tail));
  } catch {
    return false;
  } finally {
    try {
      handle?.close();
    } catch {
      // Released with the process at the latest.
    }
  }
}
