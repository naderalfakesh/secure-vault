import { File, FileMode } from 'expo-file-system';

// PDF /Encrypt trailers live in the first (linearised) or last 64 KB.
const WINDOW_BYTES = 64 * 1024;
const ENCRYPT_ENTRY = /\/Encrypt[\s/<\d]/;

function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return text;
}

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
      // Ignored; handle closes with process exit.
    }
  }
}
