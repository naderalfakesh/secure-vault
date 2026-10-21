import { Platform } from 'react-native';

import { t } from '@/i18n';

/**
 * "How your data is protected" (handover §7.6). Every sentence is checked
 * against docs/SECURITY.md; where §7.6 said more than the code does, the
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
    t('settings.protection.fact.mlkit'),
  ];
}

export const PROTECTION_LIMITS = [
  t('settings.protection.limit.pin'),
  t('settings.protection.limit.share'),
  t('settings.protection.limit.passphrase'),
  t('settings.protection.limit.tampered'),
  t('settings.protection.limit.cache'),
];
