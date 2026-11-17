import { Pressable, View } from 'react-native';

import { t, tp } from '@/i18n';
import { isolate } from '@/utils/bidi';

import { Icon } from '../Icon';
import { Text } from '../Text';
import type { CollectionTileProps } from './types';
import { styles } from './CollectionTile.styles';

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
