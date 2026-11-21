import { t } from '@/i18n';
import { at } from '@/testing/lists';

import { introSlides } from '../helpers';

describe('introSlides', () => {
  it('shows the papers, the seal and the unlock, in that order', () => {
    expect(introSlides('Unlock body', 'ios').map((slide) => slide.scene)).toEqual([
      'papers',
      'sealed',
      'unlock',
    ]);
  });

  it('words the second slide for the platform', () => {
    expect(at(introSlides('', 'ios'), 1).body).toBe(t('onboarding.intro.2.bodyIos'));
    expect(at(introSlides('', 'android'), 1).body).toBe(t('onboarding.intro.2.bodyAndroid'));
  });

  it('takes the unlock slide body as given', () => {
    const slides = introSlides('Use Face ID', 'ios');
    expect(slides[2]).toEqual({
      scene: 'unlock',
      title: t('onboarding.intro.3.title'),
      body: 'Use Face ID',
    });
  });
});
