import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { isolate } from '@/utils/bidi';

import { Icon } from './Icon';
import { PaperThumbnail } from './PaperThumbnail';
import { Text } from './Text';

/** A piece of a search snippet; `match` pieces are highlighted. */
export type SnippetPart = { text: string; match?: boolean };

export type DocumentRowProps = {
  title: string;
  /** "Collection · N pages · relative date". */
  meta: string;
  /** Optional full-text match line with highlighted pieces. */
  snippet?: readonly SnippetPart[];
  thumbnail?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Multi-select mode: a leading check circle replaces the chevron. */
  selectable?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** Library row (handover §4): paper thumbnail, title, meta, optional snippet. */
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
        <Text variant="headline">{isolate(title)}</Text>
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

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 76,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
  },
  selected: { backgroundColor: theme.colors.primaryMuted },
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  check: (on: boolean) => ({
    width: 26,
    height: 26,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: on ? 0 : 1.5,
    borderColor: theme.colors.borderStrong,
    backgroundColor: on ? theme.colors.primary : 'transparent',
  }),
  body: {
    flex: 1,
    gap: 2,
  },
  mark: {
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.accentMuted,
  },
}));
