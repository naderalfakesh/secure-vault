import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import vault from '@modules/expo-vault';

import ProtectionScreen from '../../app/settings/protection';
import { mlKitDisclosure, protectionFacts } from '../features/session/protectionCopy';

jest.mock('expo-router', () => ({ router: { back: jest.fn() }, Stack: { Screen: () => null } }));

describe('How your data is protected', () => {
  it('lists the facts and the limits without hardware or network claims', async () => {
    const view = await render(<ProtectionScreen />);

    expect(view.getByRole('header', { name: 'How your data is protected' })).toBeOnTheScreen();
    expect(
      view.getByText(/kept by the iOS Keychain\. It is never put in a backup\./),
    ).toBeOnTheScreen();
    expect(view.getByText(/stored only as a salted hash/)).toBeOnTheScreen();
    // Android's ML Kit sends Google usage metrics, so the claim stays "itself".
    expect(
      view.getByText(/There is no account, and SecureVault itself collects no analytics\./),
    ).toBeOnTheScreen();
    // iOS scans with VisionKit and reads with Apple Vision (ADR 0011): no Google notice.
    expect(
      view.getByText(
        'SecureVault reads document text on this phone with Apple’s Vision framework, which is part of iOS. The text isn’t sent anywhere.',
      ),
    ).toBeOnTheScreen();
    expect(view.queryByText(/ML Kit|Google|Play services/)).toBeNull();
    expect(mlKitDisclosure()).toBeNull();
    expect(view.queryByText(/anonymous/i)).toBeNull();
    expect(
      view.queryByText(/^There is no account, and SecureVault collects no analytics\.$/),
    ).toBeNull();
    expect(view.getByText('What it can’t protect against')).toBeOnTheScreen();
    expect(view.getByText(/A lost backup passphrase/)).toBeOnTheScreen();
    // The index is SQLCipher, not AES-256-GCM, so the sentence does not say so.
    expect(view.queryByText(/index (is|are) encrypted .*AES-256-GCM/)).toBeNull();
    expect(view.queryByText(/Secure Enclave|secure hardware|StrongBox|never leaves/i)).toBeNull();
  });

  it('names the Secure Enclave once the vault reports its key there', async () => {
    await vault.createVault();
    const view = await render(<ProtectionScreen />);
    expect(
      await view.findByText(
        'The encryption key is created on this phone and sealed by its Secure Enclave, so no other device can open it. It is never put in a backup.',
      ),
    ).toBeOnTheScreen();
    expect(view.queryByText(/kept by the iOS Keychain/)).toBeNull();
  });

  it('claims secure hardware only for what the device reports', () => {
    expect(protectionFacts('trusted-environment')[1]).toBe(
      'The encryption key is created inside this phone’s secure hardware and never leaves it. It is never put in a backup.',
    );
    expect(protectionFacts('strongbox')[1]).toMatch(/inside this phone’s StrongBox security chip/);
    for (const plain of ['keychain', 'software', 'none', null] as const) {
      expect(protectionFacts(plain)[1]).toMatch(/kept by the iOS Keychain\./);
      expect(protectionFacts(plain)[1]).not.toMatch(
        /Secure Enclave|secure hardware|StrongBox|never leaves/,
      );
    }
  });

  it('names the Android Keystore on Android', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      expect(protectionFacts()[1]).toMatch(/kept by the Android Keystore\./);
      expect(mlKitDisclosure()).toBe(
        'SecureVault uses Google ML Kit to read document text on this phone. It also uses the Google Play services document scanner. ML Kit sends Google usage and performance metrics, which include an ID for this install. Google says ML Kit doesn’t send your images or the text it reads. This can’t be turned off.',
      );
      // Android reads with ML Kit, so the Apple Vision sentence is not among the facts.
      expect(protectionFacts().join(' ')).not.toMatch(/Vision/);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('shows the ML Kit notice on Android only', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      const view = await render(<ProtectionScreen />);
      expect(view.getByLabelText(/^SecureVault uses Google ML Kit/)).toBeOnTheScreen();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('marks every iOS fact, Apple Vision included, with a success check', async () => {
    const view = await render(<ProtectionScreen />);
    expect(view.queryByLabelText(/ML Kit/)).toBeNull();
    // No notice on iOS: the success checks are exactly the facts.
    type Node = { props?: Record<string, unknown>; children?: (Node | string)[] | null };
    const names: unknown[] = [];
    const walk = (node: Node | string | null) => {
      if (!node || typeof node === 'string') return;
      if (node.props && 'name' in node.props) names.push(node.props.name);
      node.children?.forEach(walk);
    };
    const root = view.toJSON() as Node | Node[] | null;
    (Array.isArray(root) ? root : [root]).forEach(walk);
    const count = (symbol: string) => names.filter((name) => name === symbol).length;
    expect(count('info.circle')).toBe(0);
    expect(count('checkmark')).toBe(protectionFacts().length);
    expect(protectionFacts()).toHaveLength(6);
  });
});
