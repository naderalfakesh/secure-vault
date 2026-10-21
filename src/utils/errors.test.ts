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

  it("keeps the app's own sentences and falls back when there is none", () => {
    expect(plainErrorMessage(new Error('Give the document a title.'), 'x')).toBe(
      'Give the document a title.',
    );
    expect(plainErrorMessage('nope', 'Could not open the document.')).toBe(
      'Could not open the document.',
    );
  });
});
