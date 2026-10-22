import { KEY_INVALIDATED_MESSAGE, KEY_LOCKED_MESSAGE, plainErrorMessage } from './errors';

describe('plainErrorMessage', () => {
  it('turns a cancelled or lapsed device key prompt into the plain sentence', () => {
    const lapsed = Object.assign(new Error('Failed to decrypt file: User not authenticated'), {
      code: 'KEY_LOCKED',
    });
    expect(plainErrorMessage(lapsed, 'Could not open the document.')).toBe(KEY_LOCKED_MESSAGE);
    expect(plainErrorMessage(new Error('User not authenticated'), 'x')).toBe(KEY_LOCKED_MESSAGE);
    expect(KEY_LOCKED_MESSAGE).not.toMatch(/authenticated/);
  });

  it('names an invalidated device key plainly', () => {
    const invalidated = Object.assign(new Error('Key permanently invalidated'), {
      code: 'KEY_INVALIDATED',
    });
    expect(plainErrorMessage(invalidated, 'x')).toBe(KEY_INVALIDATED_MESSAGE);
  });

  it("names an index SQLite cannot read plainly instead of SQLite's text", () => {
    for (const message of [
      'file is not a database',
      'Error code 26: file is encrypted or is not a database',
    ]) {
      expect(plainErrorMessage(new Error(message), 'x')).toBe(
        'The document index could not be opened, so it stays closed. Nothing was changed.',
      );
    }
  });

  it("keeps the app's own sentences and falls back when there is none", () => {
    expect(plainErrorMessage(new Error('Give the document a title.'), 'x')).toBe(
      'Give the document a title.',
    );
    expect(plainErrorMessage('nope', 'Could not open the document.')).toBe(
      'Could not open the document.',
    );
  });

  it('never shows a rejected native call or a platform exception name', () => {
    for (const message of [
      "Call to function 'ExpoVault.putFile' has been rejected. → Caused by: java.lang.IllegalStateException",
      'java.lang.NullPointerException',
      'Caused by: kotlin.UninitializedPropertyAccessException',
      'The operation couldn’t be completed. (NSCocoaErrorDomain error 4.)',
      'Error Domain=NSOSStatusErrorDomain Code=-34018',
      'SQLiteFullException: database or disk is full',
    ]) {
      expect(plainErrorMessage(new Error(message), 'Couldn’t save the document.')).toBe(
        'Couldn’t save the document.',
      );
    }
  });

  it('never shows a platform message that names a file path', () => {
    const fallback = 'Couldn’t save the document.';
    for (const message of [
      'Failed to read /data/user/0/com.naderalfakesh.securevault/cache/ImagePicker/1.jpg',
      "File 'file:///var/mobile/Containers/Data/Application/X/Library/Caches/a.pdf' does not exist",
      'Unable to open content://com.android.providers.media.documents/document/image%3A12',
      "ENOENT: no such file or directory, open '/private/var/mobile/tmp/scan.jpg'",
    ]) {
      expect(plainErrorMessage(new Error(message), fallback)).toBe(fallback);
    }
    expect(plainErrorMessage(new Error('Pick 1/2 pages first.'), fallback)).toBe(
      'Pick 1/2 pages first.',
    );
  });
});
