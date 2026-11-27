import { ActivityIndicator, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './StagePlaceholder.styles';

type StagePlaceholderProps = {
  loading: boolean;
  slow: boolean;
};

export function StagePlaceholder({ loading, slow }: StagePlaceholderProps) {
  const { theme } = useUnistyles();
  const unavailable = !loading;
  const spinner = loading && slow;
  return (
    <View style={styles.placeholder}>
      {spinner ? (
        <View style={styles.placeholderPage}>
          <ActivityIndicator color={theme.colors.onStageDim} />
        </View>
      ) : null}
      {unavailable ? (
        <Text variant="footnote" style={styles.dim}>
          {t('viewer.previewUnavailable')}
        </Text>
      ) : null}
    </View>
  );
}
