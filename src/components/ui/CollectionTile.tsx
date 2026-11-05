import { Children, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t, tp } from '@/i18n';
import { isolate } from '@/utils/bidi';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type CollectionTileProps = {
  name: string;
  count: number;
  icon: IconName;
  onPress?: () => void;
  testID?: string;
};

/** Collection tile: tinted icon tile, name, and document count. */
export function CollectionTile({ name, count, icon, onPress, testID }: CollectionTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('ui.list.item', {
        title: isolate(name),
        detail: tp('format.documents', count),
      })}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.iconTile}>
        <Icon name={icon} size={20} tone="accent" />
      </View>
      <View style={styles.footer}>
        <Text variant="subheadline" style={styles.name}>
          {name}
        </Text>
        <Text variant="subheadline" tone="secondary">
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

/** Two-column grid of collection tiles. */
export function CollectionGrid({ children }: { children: ReactNode }) {
  const tiles = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let index = 0; index < tiles.length; index += 2) {
    rows.push(tiles.slice(index, index + 2));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.gridRow}>
          {row.map((tile, column) => (
            <View key={column} style={styles.cell}>
              {tile}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  tile: {
    flex: 1,
    padding: 14,
    gap: 10,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    minHeight: theme.touchTarget,
  },
  pressed: { opacity: 0.85 },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  name: {
    flex: 1,
    fontWeight: '600',
  },
  grid: {
    gap: theme.spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  cell: {
    flex: 1,
  },
}));
