import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t } from '@/i18n';
import { isolate } from '@/utils/bidi';

import { PaperThumbnail } from './PaperThumbnail';
import { Text } from './Text';

export type DocumentCardProps = {
  title: string;
  /** Brass line for the Expiring soon rail, e.g. "Expires in 82 days". */
  expiry?: string;
  /** Quiet second line when there is no expiry, e.g. the date added. */
  meta?: string;
  /** Decrypted thumbnail; the paper placeholder shows without one. */
  thumbnail?: ReactNode;
  /** `rail` is a fixed 210 pt card for horizontal rails; `grid` fills its column. */
  layout?: 'rail' | 'grid';
  onPress?: () => void;
  /** Defaults to the title plus the visible lines. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/** Document card (handover §4): paper thumbnail, title, brass expiry line. */
export function DocumentCard({
  title,
  expiry,
  meta,
  thumbnail,
  layout = 'rail',
  onPress,
  accessibilityLabel,
  accessibilityHint = t('ui.documentCard.hint'),
  testID,
}: DocumentCardProps) {
  const label = accessibilityLabel ?? [title, expiry ?? meta].filter(Boolean).join(', ');
  const thumbHeight = layout === 'rail' ? 92 : 120;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [styles.card(layout), pressed && styles.pressed]}
    >
      <View style={styles.thumbnail(thumbHeight)}>
        <PaperThumbnail width={undefined} height={thumbHeight} radius={12}>
          {thumbnail}
        </PaperThumbnail>
      </View>
      <View style={styles.body}>
        <Text variant="callout" numberOfLines={1} style={styles.title}>
          {isolate(title)}
        </Text>
        {expiry ? (
          <Text variant="footnote" tone="warning" numberOfLines={1} style={styles.expiry}>
            {expiry}
          </Text>
        ) : meta ? (
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: (layout: 'rail' | 'grid') => ({
    width: layout === 'rail' ? 210 : undefined,
    flex: layout === 'grid' ? 1 : undefined,
    padding: theme.spacing.sm,
    gap: 10,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
  }),
  pressed: { opacity: 0.85 },
  thumbnail: (height: number) => ({
    height,
  }),
  body: {
    gap: 2,
  },
  title: {
    fontWeight: '600',
  },
  expiry: {
    fontWeight: '600',
  },
}));
