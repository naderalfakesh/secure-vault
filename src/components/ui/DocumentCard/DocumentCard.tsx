import { Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { isolate } from '@/utils/bidi';

import { PaperThumbnail } from '../PaperThumbnail';
import { Text } from '../Text';
import { THUMBNAIL_HEIGHT } from './constants';
import { styles } from './DocumentCard.styles';
import type { DocumentCardProps } from './types';

/** Document card: paper thumbnail, title, brass expiry line. */
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
  const thumbHeight = THUMBNAIL_HEIGHT[layout];

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
        <Text variant="callout" style={styles.title}>
          {isolate(title)}
        </Text>
        {expiry ? (
          <Text variant="footnote" tone="warning" style={styles.expiry}>
            {expiry}
          </Text>
        ) : meta ? (
          <Text variant="footnote" tone="secondary">
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
