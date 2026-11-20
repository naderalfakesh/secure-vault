import { Platform } from 'react-native';

import type { KeyProtection } from '../../../modules/expo-vault';
import { t } from '@/i18n';

/**
 * The key sentence. It names the Secure Enclave or secure hardware only when
 * the vault module reports that this device's key is held there (ADR 0009);
 * before that answer, or without such hardware, it names the Keychain or the
 * Keystore and claims nothing more.
 */
function keyFact(protection: KeyProtection | null): string {
  switch (protection) {
    case 'secure-enclave':
      return t('settings.protection.fact.keyEnclave');
    case 'strongbox':
      return t('settings.protection.fact.keyHardware', {
        hardware: t('settings.protection.fact.strongbox'),
      });
    case 'trusted-environment':
      return t('settings.protection.fact.keyHardware', {
        hardware: t('settings.protection.fact.trustedEnvironment'),
      });
    default:
      return t('settings.protection.fact.key', {
        keeper: t(
          Platform.OS === 'ios'
            ? 'settings.protection.fact.keeperIos'
            : 'settings.protection.fact.keeperAndroid',
        ),
      });
  }
}

/**
 * "How your data is protected". Every sentence is checked against
 * docs/SECURITY.md; where the design copy said more than the code does, the
 * sentence was narrowed (see docs/verification/redesign-onboarding.md).
 */
export function protectionFacts(protection: KeyProtection | null = null): string[] {
  const facts = [
    t('settings.protection.fact.encrypted'),
    keyFact(protection),
    t('settings.protection.fact.pin'),
    t('settings.protection.fact.backup'),
    t('settings.protection.fact.account'),
  ];
  // iOS reads text with Apple Vision, part of the system (ADR 0011).
  if (Platform.OS === 'ios') facts.push(t('settings.protection.fact.textVision'));
  return facts;
}

/**
 * The Google ML Kit disclosure, Android only: a notice rather than a
 * protection, so the screen shows it with an info icon. iOS uses no ML Kit
 * and gets null.
 */
export function mlKitDisclosure(): string | null {
  return Platform.OS === 'android' ? t('settings.protection.fact.mlkit') : null;
}

export const PROTECTION_LIMITS = [
  t('settings.protection.limit.pin'),
  t('settings.protection.limit.share'),
  t('settings.protection.limit.passphrase'),
  t('settings.protection.limit.tampered'),
  t('settings.protection.limit.cache'),
];
