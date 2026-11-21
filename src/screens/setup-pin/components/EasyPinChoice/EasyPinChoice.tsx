import { View } from 'react-native';

import { Button } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './EasyPinChoice.styles';

type EasyPinChoiceProps = {
  onUseAnyway: () => void;
  onChooseAnother: () => void;
};

/** An easy PIN is only a soft warning: keep it, or choose another. */
export function EasyPinChoice({ onUseAnyway, onChooseAnother }: EasyPinChoiceProps) {
  return (
    <View style={styles.easy}>
      <Button
        label={t('onboarding.pin.useAnyway')}
        variant="tinted"
        size="md"
        onPress={onUseAnyway}
      />
      <Button
        label={t('onboarding.pin.chooseAnother')}
        variant="plain"
        size="md"
        onPress={onChooseAnother}
      />
    </View>
  );
}
