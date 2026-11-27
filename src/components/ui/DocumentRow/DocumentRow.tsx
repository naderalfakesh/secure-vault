import { Pressable, View } from 'react-native';

import { textScale } from '@/theme/tokens';
import { isolate } from '@/utils/bidi';

import { Icon } from '../Icon';
import { PaperThumbnail } from '../PaperThumbnail';
import { Text } from '../Text';
import { styles } from './DocumentRow.styles';
import type { DocumentRowProps } from './types';

export function DocumentRow({
  title,
  meta,
  snippet,
  thumbnail,
  onPress,
  onLongPress,
  selectable = false,
  selected = false,
  accessibilityLabel,
  testID,
}: DocumentRowProps) {
  const snippetText = snippet?.map((part) => part.text).join('');
  const label = accessibilityLabel ?? [title, meta, snippetText].filter(Boolean).join(', ');
  const isSelected = selectable && selected;

  return (
    <Pressable
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={selectable ? { checked: isSelected } : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        isSelected && styles.selected,
        pressed && !isSelected && styles.pressed,
      ]}
    >
      {selectable ? (
        <View style={styles.check(isSelected)}>
          {isSelected ? <Icon name="check" size={14} tone="inverse" /> : null}
        </View>
      ) : null}
      <PaperThumbnail>{thumbnail}</PaperThumbnail>
      <View style={styles.body}>
        <Text variant="headline" maxFontSizeMultiplier={textScale.rowTitleMax}>
          {isolate(title)}
        </Text>
        <Text variant="footnote" tone="secondary">
          {meta}
        </Text>
        {snippet?.length ? (
          <Text variant="footnote" tone="secondary">
            {snippet.map((part, index) =>
              part.match ? (
                <Text key={index} variant="footnote" style={styles.mark} testID="snippet-match">
                  {part.text}
                </Text>
              ) : (
                part.text
              ),
            )}
          </Text>
        ) : null}
      </View>
      {!selectable && onPress ? <Icon name="chevronRight" size={18} tone="tertiary" /> : null}
    </Pressable>
  );
}
