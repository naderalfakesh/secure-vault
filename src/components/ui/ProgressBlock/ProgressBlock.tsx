import { View } from 'react-native';

import { t } from '@/i18n';

import { useThrottledAnnouncement } from '../announce';
import { Text } from '../Text';
import { progressPercent } from './helpers';
import { styles } from './ProgressBlock.styles';
import type { ProgressBlockProps } from './types';

/** Determinate progress: label, optional detail, 6 pt bar. */
export function ProgressBlock({ label, detail, progress, testID }: ProgressBlockProps) {
  // A polite live region on Android; iOS ignores live regions, so it hears
  // the line when it appears and then at most every few seconds.
  useThrottledAnnouncement(label);
  const percent = progressPercent(progress);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: percent,
        text: detail ? t('ui.progress.withDetail', { label, detail }) : label,
      }}
      accessibilityLiveRegion="polite"
      style={styles.block}
      testID={testID}
    >
      <View style={styles.header}>
        <Text variant="subheadline" style={styles.label}>
          {label}
        </Text>
        {detail ? (
          <Text variant="subheadline" tone="secondary">
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} testID="progress-fill" />
      </View>
    </View>
  );
}
