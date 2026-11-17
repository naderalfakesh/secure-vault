import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui';
import { t } from '@/i18n';

import { STAGE_INK_DIM } from '../../constants';
import { styles } from './StagePlaceholder.styles';

type StagePlaceholderProps = {
  loading: boolean;
  /** Loading has taken long enough to show the placeholder page. */
  slow: boolean;
};

/** The stage before the pages arrive, or when there are none to show. */
export function StagePlaceholder({ loading, slow }: StagePlaceholderProps) {
  return (
    <View style={styles.placeholder}>
      {loading && slow ? (
        <View style={styles.placeholderPage}>
          <ActivityIndicator color={STAGE_INK_DIM} />
        </View>
      ) : !loading ? (
        <Text variant="footnote" style={styles.dim}>
          {t('viewer.previewUnavailable')}
        </Text>
      ) : null}
    </View>
  );
}
