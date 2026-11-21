import { View } from 'react-native';

import { Button } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './IntroFooter.styles';
import type { Slide } from '../../types';

export type IntroFooterProps = {
  slides: Slide[];
  page: number;
  onNext: () => void;
};

/** The step dots, read as "step n of m", over Continue (Set up on the last slide). */
export function IntroFooter({ slides, page, onNext }: IntroFooterProps) {
  const last = page === slides.length - 1;
  return (
    <View style={styles.footer}>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={t('onboarding.intro.step', { step: page + 1, total: slides.length })}
      >
        {slides.map((slide, index) => (
          <View key={slide.title} style={styles.dot(index === page)} />
        ))}
      </View>
      <Button label={last ? t('onboarding.intro.setUp') : t('common.continue')} onPress={onNext} />
    </View>
  );
}
