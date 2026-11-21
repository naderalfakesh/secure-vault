import { View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { t } from '@/i18n';
import { isolate } from '@/utils/bidi';

import { styles } from './ViewerTopBar.styles';
import { TOP_BAR_GAP } from '../../constants';

type ViewerTopBarProps = {
  insetTop: number;
  /** The document's title, once it has loaded. */
  title: string | null;
  pageLine: string;
  shareDisabled: boolean;
  moreDisabled: boolean;
  onBack: () => void;
  onShare: () => void;
  onMore: () => void;
};

/** Back, the title and page line, Share and More over the stage. */
export function ViewerTopBar({
  insetTop,
  title,
  pageLine,
  shareDisabled,
  moreDisabled,
  onBack,
  onShare,
  onMore,
}: ViewerTopBarProps) {
  return (
    <View style={[styles.topBar, { paddingTop: insetTop + TOP_BAR_GAP }]} pointerEvents="box-none">
      <IconButton
        icon="back"
        variant="glass"
        accessibilityLabel={t('viewer.backToLibrary')}
        onPress={onBack}
      />
      <View style={styles.titleBlock}>
        {title !== null ? (
          <Text variant="headline" numberOfLines={2} style={styles.ink}>
            {isolate(title)}
          </Text>
        ) : null}
        {pageLine ? (
          <Text variant="caption" style={styles.dim}>
            {pageLine}
          </Text>
        ) : null}
      </View>
      <View style={styles.topActions}>
        <IconButton
          icon="share"
          variant="glass"
          accessibilityLabel={t('viewer.shareCopy')}
          onPress={onShare}
          disabled={shareDisabled}
        />
        <IconButton
          icon="more"
          variant="glass"
          accessibilityLabel={t('viewer.moreActions')}
          onPress={onMore}
          disabled={moreDisabled}
        />
      </View>
    </View>
  );
}
