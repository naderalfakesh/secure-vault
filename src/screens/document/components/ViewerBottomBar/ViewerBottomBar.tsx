import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { t } from '@/i18n';

import { BOTTOM_BAR_GAP, STAGE_INK } from '../../constants';
import { PageStrip } from '../PageStrip';
import { styles } from './ViewerBottomBar.styles';

type ViewerBottomBarProps = {
  insetBottom: number;
  pages: readonly string[];
  page: number;
  onPageChange: (index: number) => void;
  onDetails: () => void;
};

/** The page strip for a multi-page document, and the Details pill. */
export function ViewerBottomBar({
  insetBottom,
  pages,
  page,
  onPageChange,
  onDetails,
}: ViewerBottomBarProps) {
  return (
    <View style={[styles.bottomBar, { paddingBottom: insetBottom + BOTTOM_BAR_GAP }]}>
      {pages.length > 1 ? (
        <PageStrip pages={pages} page={page} onPageChange={onPageChange} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('viewer.details')}
        onPress={onDetails}
        style={styles.detailsPill}
      >
        <Icon name="info" size={18} color={STAGE_INK} />
        <Text variant="callout" style={[styles.ink, styles.pillLabel]}>
          {t('viewer.details')}
        </Text>
      </Pressable>
    </View>
  );
}
