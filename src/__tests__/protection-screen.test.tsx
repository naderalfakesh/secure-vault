import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import ProtectionScreen from '../../app/settings/protection';
import { protectionFacts } from '../features/session/protectionCopy';

jest.mock('expo-router', () => ({ router: { back: jest.fn() }, Stack: { Screen: () => null } }));

describe('How your data is protected', () => {
  it('lists the facts and the limits without hardware or network claims', async () => {
    const view = await render(<ProtectionScreen />);

    expect(view.getByRole('header', { name: 'How your data is protected' })).toBeOnTheScreen();
    expect(
      view.getByText(/kept by the iOS Keychain\. It is never put in a backup\./),
    ).toBeOnTheScreen();
    expect(view.getByText(/stored only as a salted hash/)).toBeOnTheScreen();
    expect(
      view.getByText('There is no account, and SecureVault collects no analytics.'),
    ).toBeOnTheScreen();
    expect(view.getByText('What it can’t protect against')).toBeOnTheScreen();
    expect(view.getByText(/A lost backup passphrase/)).toBeOnTheScreen();
    // The index is SQLCipher, not AES-256-GCM, so the sentence does not say so.
    expect(view.queryByText(/index (is|are) encrypted .*AES-256-GCM/)).toBeNull();
    expect(view.queryByText(/Secure Enclave|secure hardware|StrongBox|never leaves/i)).toBeNull();
  });

  it('names the Android Keystore on Android', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      expect(protectionFacts()[1]).toMatch(/kept by the Android Keystore\./);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });
});
