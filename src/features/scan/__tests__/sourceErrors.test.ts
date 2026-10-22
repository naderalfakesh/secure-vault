import { KEY_INVALIDATED_MESSAGE, KEY_LOCKED_MESSAGE } from '@/utils/errors';

import { sourceFailureMessage } from '../sourceErrors';

const coded = (code: string, message = 'native text') =>
  Object.assign(new Error(message), { code });

describe('sourceFailureMessage', () => {
  it('names each scanner failure in a plain sentence', () => {
    expect(sourceFailureMessage('scan', coded('SCANNER_UNAVAILABLE'))).toMatch(/isn’t available/);
    expect(sourceFailureMessage('scan', coded('SCAN_FAILED'))).toMatch(/didn’t finish/);
    expect(sourceFailureMessage('scan', coded('SCAN_IN_PROGRESS'))).toMatch(/already open/);
    expect(sourceFailureMessage('scan', coded('NO_ACTIVITY'))).toMatch(/couldn’t open/);
    expect(sourceFailureMessage('scan', new Error('java.lang.NullPointerException'))).toBe(
      'The document scanner couldn’t open. Try again, or take a photo instead.',
    );
  });

  it('never returns the platform text for any source', () => {
    for (const source of ['scan', 'camera', 'library', 'files'] as const) {
      const message = sourceFailureMessage(source, new Error('java.lang.IllegalStateException'));
      expect(message).not.toMatch(/java|Exception/);
      expect(sourceFailureMessage(source, 'nope')).toBe(message);
    }
  });

  it('keeps the vault key sentences', () => {
    expect(sourceFailureMessage('files', coded('KEY_INVALIDATED'))).toBe(KEY_INVALIDATED_MESSAGE);
    expect(sourceFailureMessage('camera', new Error('User not authenticated'))).toBe(
      KEY_LOCKED_MESSAGE,
    );
  });
});
