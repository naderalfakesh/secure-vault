import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t } from '@/i18n';

import { Text } from './Text';

export type ProgressBlockProps = {
  /** "Verb X of N", e.g. "Checking 18 of 48". */
  label: string;
  /** Optional right-hand text: a percentage or "Step 1 of 2". */
  detail?: string;
  /** 0 to 1. */
  progress: number;
  testID?: string;
};

/** Determinate progress (handover §4): label, optional detail, 6 pt bar. */
export function ProgressBlock({ label, detail, progress, testID }: ProgressBlockProps) {
  const percent = Math.round(
    Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * 100,
  );

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

const styles = StyleSheet.create((theme) => ({
  block: {
    gap: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  label: {
    flex: 1,
    fontWeight: '600',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
}));
