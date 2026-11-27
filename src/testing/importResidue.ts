import { Directory, File, Paths } from 'expo-file-system';

// The mock file system has no app container; give it the iOS layout so the
// app's tmp folder is a sibling of Documents, as on a device.
export const MOCK_CONTAINER = 'file:///mock/';

export const mockTmp = () => new Directory(`${MOCK_CONTAINER}tmp/`);

export function plantPlaintext(directory: Directory, name: string): File {
  if (!directory.exists) directory.create({ intermediates: true });
  const file = new File(directory, name);
  file.writeSync('plaintext');
  return file;
}

export function removeQuietly(entry: File | Directory) {
  if (entry.exists) entry.delete();
}

/**
 * The mock file system never resolves `..` or `%2E%2E`, so a traversal input
 * would not reach a real file there anyway; assert the guard refuses it before
 * anything is deleted.
 */
export function expectRefused(discard: () => void) {
  const spies = [
    jest.spyOn(File.prototype, 'exists', 'get'),
    jest.spyOn(File.prototype, 'delete'),
    jest.spyOn(Directory.prototype, 'exists', 'get'),
    jest.spyOn(Directory.prototype, 'delete'),
  ];
  try {
    discard();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

export function mockDocumentsFolder() {
  const documentsFolder = new Directory(`${MOCK_CONTAINER}Documents/`);
  if (!documentsFolder.exists) documentsFolder.create({ intermediates: true });
  return jest.spyOn(Paths, 'document', 'get').mockReturnValue(documentsFolder);
}
