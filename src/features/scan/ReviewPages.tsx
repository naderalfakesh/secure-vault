import { useState } from 'react';
import {
  AccessibilityInfo,
  type AccessibilityActionEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, IconButton, Text } from '@/components/ui';
import { DocumentImage } from '@/features/documents/DocumentImage';
import { t } from '@/i18n';
import type { PickedFile } from '@/types';

import { movedTo, pageLabel, pagePosition, scanText } from './scanCopy';

export type ReviewPagesProps = {
  pages: readonly PickedFile[];
  onRemove: (index: number) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  /** Re-opens the scanner; absent when it cannot run here. */
  onAddPages?: () => void;
};

/** The actions a page offers: no move past either end. */
function pageActions(index: number, count: number) {
  return [
    ...(index > 0 ? [{ name: 'moveEarlier', label: scanText('review.moveEarlier') }] : []),
    ...(index < count - 1 ? [{ name: 'moveLater', label: scanText('review.moveLater') }] : []),
    { name: 'remove', label: scanText('review.remove') },
  ];
}

/**
 * Scanned pages before anything is read or saved (handover §6 J1, F12): remove
 * a page, move one by holding it and using Move earlier / Move later, or add
 * more. Screen readers get the same three as actions on each page.
 */
export function ReviewPages({ pages, onRemove, onMove, onAddPages }: ReviewPagesProps) {
  // The page being moved, followed as it changes place.
  const [moving, setMoving] = useState<number | null>(null);
  const count = pages.length;
  const active = moving !== null && moving < count ? moving : null;

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= count) return;
    onMove(index, delta);
    if (active === index) setMoving(target);
    // The label changes under the reader's focus; say where the page went.
    AccessibilityInfo.announceForAccessibility(movedTo(target, count));
  };

  const remove = (index: number) => {
    setMoving(null);
    onRemove(index);
  };

  const onAction = (index: number) => (event: AccessibilityActionEvent) => {
    const action = event.nativeEvent.actionName;
    if (action === 'moveEarlier') move(index, -1);
    else if (action === 'moveLater') move(index, 1);
    else if (action === 'remove') remove(index);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {pages.map((page, index) => (
            <View key={page.uri} style={styles.cell}>
              <Pressable
                accessibilityLabel={pagePosition(index, count, active === index)}
                accessibilityHint={scanText('review.hint')}
                accessibilityActions={pageActions(index, count)}
                onAccessibilityAction={onAction(index)}
                onLongPress={() => setMoving(index)}
                style={[styles.page, active === index && styles.pageMoving]}
              >
                <DocumentImage
                  source={{ uri: page.uri }}
                  style={styles.image}
                  contentFit="cover"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              </Pressable>
              <View style={styles.remove}>
                <IconButton
                  icon="close"
                  size={16}
                  accessibilityLabel={t('scan.removePage', { number: index + 1 })}
                  onPress={() => remove(index)}
                />
              </View>
              <Text variant="footnote" tone="secondary" align="center">
                {pageLabel(index)}
              </Text>
            </View>
          ))}
          {onAddPages ? (
            <View style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={scanText('review.addPages')}
                onPress={onAddPages}
                style={({ pressed }) => [styles.page, styles.addTile, pressed && styles.pressed]}
              >
                <Icon name="plus" size={22} tone="accent" />
                <Text variant="footnote" tone="accent" style={styles.addLabel}>
                  {scanText('review.addPages')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <Text variant="footnote" tone="secondary" align="center">
          {scanText('review.hint')}
        </Text>
      </ScrollView>
      {active !== null ? (
        <View style={styles.moveBar}>
          <Button
            label={scanText('review.moveEarlier')}
            variant="secondary"
            size="md"
            icon="chevronLeft"
            disabled={active === 0}
            onPress={() => move(active, -1)}
          />
          <Button
            label={scanText('review.moveLater')}
            variant="secondary"
            size="md"
            icon="chevronRight"
            disabled={active === count - 1}
            onPress={() => move(active, 1)}
          />
          <Button
            label={scanText('review.doneMoving')}
            variant="plain"
            size="md"
            onPress={() => setMoving(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.spacing.md,
    columnGap: theme.spacing.sm,
  },
  cell: {
    width: '31%',
    gap: theme.spacing.xs,
  },
  page: {
    aspectRatio: 0.75,
    borderRadius: theme.radii.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.paper,
    overflow: 'hidden',
  },
  pageMoving: {
    borderColor: theme.colors.primary,
  },
  image: {
    flex: 1,
  },
  remove: {
    position: 'absolute',
    top: -theme.spacing.sm,
    end: -theme.spacing.sm,
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    backgroundColor: 'transparent',
  },
  addLabel: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  moveBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
}));
