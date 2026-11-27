import { Platform } from 'react-native';

import { t } from '@/i18n';
import type { KeyProtection } from '@modules/expo-vault';

// Only claim Secure Enclave / StrongBox / TEE when the vault module confirms it.
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

export function protectionFacts(protection: KeyProtection | null = null): string[] {
  const facts = [
    t('settings.protection.fact.encrypted'),
    keyFact(protection),
    t('settings.protection.fact.pin'),
    t('settings.protection.fact.backup'),
    t('settings.protection.fact.account'),
  ];
  if (Platform.OS === 'ios') facts.push(t('settings.protection.fact.textVision'));
  return facts;
}

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
