import { Platform } from 'react-native';

import { t } from '@/i18n';

/**
 * "How your data is protected". Every sentence is checked against
 * docs/SECURITY.md; where the design copy said more than the code does, the
 * sentence was narrowed (see docs/verification/redesign-onboarding.md).
 */
export function protectionFacts(): string[] {
  const keeper = t(
    Platform.OS === 'ios'
      ? 'settings.protection.fact.keeperIos'
      : 'settings.protection.fact.keeperAndroid',
  );
  return [
    t('settings.protection.fact.encrypted'),
    t('settings.protection.fact.key', { keeper }),
    t('settings.protection.fact.pin'),
    t('settings.protection.fact.backup'),
    t('settings.protection.fact.account'),
  ];
}

/**
 * The Google ML Kit disclosure, a notice rather than a protection, so the
 * screen shows it with an info icon. The Play services scanner is Android's.
 */
export function mlKitDisclosure(): string {
  return t('settings.protection.fact.mlkit', {
    scanner: Platform.OS === 'android' ? t('settings.protection.fact.mlkitScanner') : '',
  });
}

export const PROTECTION_LIMITS = [
  t('settings.protection.limit.pin'),
  t('settings.protection.limit.share'),
  t('settings.protection.limit.passphrase'),
  t('settings.protection.limit.tampered'),
  t('settings.protection.limit.cache'),
];
