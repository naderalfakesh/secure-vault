import { View } from 'react-native';

import { Button, InlineAlert } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './NoTextNotice.styles';

type NoTextNoticeProps = {
  reading: boolean;
  disabled: boolean;
  onReadAgain: () => void;
};

export function NoTextNotice({ reading, disabled, onReadAgain }: NoTextNoticeProps) {
  return (
    <View style={styles.noText}>
      <InlineAlert tone="info" message={t('viewer.noText')} />
      <Button
        label={t('viewer.readAgain')}
        loadingLabel={t('viewer.reading')}
        variant="tinted"
        size="md"
        loading={reading}
        disabled={disabled}
        onPress={onReadAgain}
      />
    </View>
  );
}
