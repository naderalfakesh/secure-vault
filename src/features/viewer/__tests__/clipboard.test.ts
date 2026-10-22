import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

import vault from '../../../../modules/expo-vault';
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

/** The system clipboard's change stamp, as the vault module reports it. */
let stamp: string | null = '7';
const bump = () => {
  stamp = String(Number(stamp) + 1);
};

describe('copied document text', () => {
  beforeEach(async () => {
    stamp = '7';
    jest.spyOn(vault, 'clipboardStamp').mockImplementation(() => stamp);
    await clearCopiedText(NOW);
    setString.mockClear();
    getString.mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('stays on this phone, expires on iOS, and is marked sensitive on Android', async () => {
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);

    expect(setString).toHaveBeenCalledWith('P<EXAMPLE<<DOE', {
      ios: { localOnly: true, expiresAt: new Date(NOW + COPIED_TEXT_EXPIRY_MS) },
      android: { isSensitive: true },
    });
    expect(COPIED_TEXT_EXPIRY_MS).toBeLessThanOrEqual(2 * 60_000);
  });

  it('is cleared when the vault locks while the clipboard is unchanged, without reading it', async () => {
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    bump(); // a second copy of ours moves the stamp; it is read after the copy
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    setString.mockClear();

    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(true);
    expect(setString).toHaveBeenCalledWith('', expect.anything());
    // Reading the content would show iOS's paste prompt or Android's toast.
    expect(getString).not.toHaveBeenCalled();
  });

  it('leaves what was copied since alone, without reading it', async () => {
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    bump(); // another app copied something
    setString.mockClear();

    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(false);
    expect(setString).not.toHaveBeenCalled();
    expect(getString).not.toHaveBeenCalled();
  });

  it('leaves the clipboard alone when its stamp cannot be read', async () => {
    stamp = null;
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    setString.mockClear();
    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(false);

    stamp = '7';
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    stamp = null;
    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(false);

    stamp = '7';
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    (vault.clipboardStamp as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no clipboard service');
    });
    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(false);
    expect(setString).not.toHaveBeenCalledWith('', expect.anything());
  });

  it('does nothing when nothing was copied, or more than once per copy', async () => {
    await expect(clearCopiedText(NOW)).resolves.toBe(false);

    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    await clearCopiedText(NOW + 1000);
    setString.mockClear();
    await expect(clearCopiedText(NOW + 2000)).resolves.toBe(false);
    expect(setString).not.toHaveBeenCalled();
  });

  it('does nothing on iOS once the system has removed the copy', async () => {
    const os = Platform.OS;
    Platform.OS = 'ios';
    try {
      await copySensitiveText('P<EXAMPLE<<DOE', NOW);
      setString.mockClear();
      await expect(clearCopiedText(NOW + COPIED_TEXT_EXPIRY_MS)).resolves.toBe(false);
      expect(setString).not.toHaveBeenCalled();
    } finally {
      Platform.OS = os;
    }
  });

  it('never throws when the clipboard cannot be written', async () => {
    await copySensitiveText('P<EXAMPLE<<DOE', NOW);
    setString.mockRejectedValueOnce(new Error('no clipboard in the background'));

    await expect(clearCopiedText(NOW + 1000)).resolves.toBe(false);
  });
});
