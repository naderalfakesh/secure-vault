import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './IntroBar.styles';

type IntroBarProps = {
  canGoBack: boolean;
  last: boolean;
  onBack: () => void;
  onSkip: () => void;
};

export function IntroBar({ canGoBack, last, onBack, onSkip }: IntroBarProps) {
  return (
    <View style={styles.bar}>
      {canGoBack ? (
        <IconButton icon="back" accessibilityLabel={t('common.back')} onPress={onBack} />
      ) : (
        <View />
      )}
      {last ? null : (
        <Button label={t('onboarding.intro.skip')} variant="plain" size="md" onPress={onSkip} />
      )}
    </View>
  );
}
