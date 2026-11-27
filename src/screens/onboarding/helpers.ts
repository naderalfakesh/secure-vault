import { Platform } from 'react-native';

import { t } from '@/i18n';

import type { Slide } from './types';

export function introSlides(unlockBody: string, os: typeof Platform.OS = Platform.OS): Slide[] {
  return [
    {
      scene: 'papers',
      title: t('onboarding.intro.1.title'),
      body: t('onboarding.intro.1.body'),
    },
    {
      scene: 'sealed',
      title: t('onboarding.intro.2.title'),
      body: os === 'ios' ? t('onboarding.intro.2.bodyIos') : t('onboarding.intro.2.bodyAndroid'),
    },
    { scene: 'unlock', title: t('onboarding.intro.3.title'), body: unlockBody },
  ];
}
