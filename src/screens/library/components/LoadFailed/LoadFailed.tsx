import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { t } from '@/i18n';

import { StatusIcon } from '../StatusIcon';
import { styles } from './LoadFailed.styles';

type LoadFailedProps = {
  error: string;
  onRetry: () => void;
};

/** A fail-closed index is not an empty vault: nothing here suggests adding. */
export function LoadFailed({ error, onRetry }: LoadFailedProps) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <StatusIcon icon="warning" tone="danger" />
      <Text variant="title3" align="center">
        {t('library.loadFailed.title')}
      </Text>
      <Text variant="subheadline" tone="secondary" align="center">
        {t('library.loadFailed.body')}
      </Text>
      <Text variant="footnote" tone="tertiary" align="center">
        {error}
      </Text>
      <Button label={t('common.tryAgain')} variant="tinted" icon="refresh" onPress={onRetry} />
    </View>
  );
}
