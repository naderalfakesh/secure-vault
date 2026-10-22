import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

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
    // ML Kit sends Google usage metrics that cannot be turned off, so no "no analytics" claim.
    expect(
      view.getByText(/There is no account, and SecureVault itself collects no analytics\./),
    ).toBeOnTheScreen();
    // iOS scans with VisionKit, so the Play services scanner is not named here.
    expect(
      view.getByText(
        'SecureVault uses Google ML Kit to read document text on this phone. ML Kit sends Google usage and performance metrics, which include an ID for this install. Google says ML Kit doesn’t send your images or the text it reads. This can’t be turned off.',
      ),
    ).toBeOnTheScreen();
    expect(view.queryByText(/Play services/)).toBeNull();
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

  it('names the Android Keystore on Android', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      expect(protectionFacts()[1]).toMatch(/kept by the Android Keystore\./);
      expect(mlKitDisclosure()).toBe(
        'SecureVault uses Google ML Kit to read document text on this phone. It also uses the Google Play services document scanner. ML Kit sends Google usage and performance metrics, which include an ID for this install. Google says ML Kit doesn’t send your images or the text it reads. This can’t be turned off.',
      );
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('marks the ML Kit notice with an info icon, not a success check', async () => {
    const view = await render(<ProtectionScreen />);
    expect(view.getByLabelText(mlKitDisclosure())).toBeOnTheScreen();
    // One info glyph for the notice; the success checks are only the facts.
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
    expect(count('info.circle')).toBe(1);
    expect(count('checkmark')).toBe(protectionFacts().length);
  });
});
