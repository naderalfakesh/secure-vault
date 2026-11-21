import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './StagePlaceholder.styles';
import { STAGE_INK_DIM } from '../../constants';

type StagePlaceholderProps = {
  loading: boolean;
  /** Loading has taken long enough to show the placeholder page. */
  slow: boolean;
};

/** The stage before the pages arrive, or when there are none to show. */
export function StagePlaceholder({ loading, slow }: StagePlaceholderProps) {
  // `slow` only happens while loading: nothing yet, then the spinner, and
  // once loading is over with no pages, the unavailable line.
  const unavailable = !loading;
  const spinner = loading && slow;
  return (
    <View style={styles.placeholder}>
      {spinner ? (
        <View style={styles.placeholderPage}>
          <ActivityIndicator color={STAGE_INK_DIM} />
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
