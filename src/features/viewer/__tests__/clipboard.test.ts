import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

import {
  clearCopiedText,
  COPIED_TEXT_EXPIRY_MS,
  copySensitiveText,
} from '@/features/viewer/clipboard';

jest.mock('expo-clipboard', () => {
  let content = '';
  return {
    setStringAsync: jest.fn(async (text: string) => {
      content = text;
      return true;
    }),
    getStringAsync: jest.fn(async () => content),
  };
});

const setString = Clipboard.setStringAsync as jest.Mock;
const getString = Clipboard.getStringAsync as jest.Mock;
const NOW = 1_800_000_000_000;

describe('copied document text', () => {
  beforeEach(async () => {
    await clearCopiedText(NOW);
    setString.mockClear();
    getString.mockClear();
  });

  it('stays on this phone, expires on iOS, and is marked sensitive on Android', async () => {
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);

    expect(setString).toHaveBeenCalledWith('P<EXAMPLE<<DOE', {
      ios: { localOnly: true, expiresAt: new Date(NOW + COPIED_TEXT_EXPIRY_MS) },
      android: { isSensitive: true },
    });
    expect(COPIED_TEXT_EXPIRY_MS).toBeLessThanOrEqual(2 * 60_000);
  });

  it('is cleared when the vault locks while it is still on the clipboard', async () => {
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    setString.mockClear();

    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(true);
    expect(setString).toHaveBeenCalledWith('', expect.anything());
    expect(await Clipboard.getStringAsync()).toBe('');
  });

  it('leaves what the user copied since alone', async () => {
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    await Clipboard.setStringAsync('something else');
    setString.mockClear();

    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(false);
    expect(setString).not.toHaveBeenCalled();
    expect(await Clipboard.getStringAsync()).toBe('something else');
  });

  it('does nothing when nothing was copied, or only once per copy', async () => {
    await expect(clearCopiedText(NOW)).resolves.toBe(false);
    expect(getString).not.toHaveBeenCalled();

    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    await clearCopiedText(NOW + 1000);
    getString.mockClear();
    await expect(clearCopiedText(NOW + 2000)).resolves.toBe(false);
    expect(getString).not.toHaveBeenCalled();
  });

  it('does not read the iOS clipboard once the system has removed the copy', async () => {
    const os = Platform.OS;
    Platform.OS = 'ios';
    try {
      await copySensitiveText('P<EXAMPLE<<DOE', NOW);
      await expect(clearCopiedText(NOW + COPIED_TEXT_EXPIRY_MS)).resolves.toBe(false);
      expect(getString).not.toHaveBeenCalled();
    } finally {
      Platform.OS = os;
    }
  });

  it('never throws when the clipboard cannot be read', async () => {
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    getString.mockRejectedValueOnce(new Error('no clipboard in the background'));

    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(false);
  });
});
