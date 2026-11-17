import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './IntroBar.styles';

export type IntroBarProps = {
  /** Back is offered from the second slide on. */
  canGoBack: boolean;
  /** The last slide has no Skip: its own button sets up. */
  last: boolean;
  onBack: () => void;
  onSkip: () => void;
};

/** Back on the leading side, Skip on the trailing one. */
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
