import { Platform } from 'react-native';

/**
 * "How your data is protected" (handover §7.6). Every sentence is checked
 * against docs/SECURITY.md; where §7.6 said more than the code does, the
 * sentence was narrowed (see docs/verification/redesign-onboarding.md).
 */
export function protectionFacts(): string[] {
  const keeper = Platform.OS === 'ios' ? 'the iOS Keychain' : 'the Android Keystore';
  return [
    'Documents are encrypted on this phone with AES-256-GCM before they’re saved. The search index is a separate encrypted database whose key is kept in the vault.',
    `The encryption key is created on this phone and kept by ${keeper}. It is never put in a backup.`,
    'Your PIN is stored only as a salted hash, never as the PIN itself.',
    'Backups are encrypted with a key made from your passphrase. SecureVault doesn’t keep the passphrase.',
    'There is no account, and SecureVault collects no analytics.',
  ];
}

export const PROTECTION_LIMITS = [
  'Someone who knows your PIN, or holds your phone while the vault is unlocked.',
  'Copies you share. Once a file leaves the vault, the receiving app controls it.',
  'A lost backup passphrase. Nobody can recover it, including us.',
  'A phone that is jailbroken or rooted, or whose operating system has been tampered with.',
  'Short-lived decrypted copies in the app’s cache while you view, add or share a document. SecureVault removes them when the vault locks.',
];
