import { View } from 'react-native';

import { t } from '@/i18n';
import { isolate } from '@/utils/bidi';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { styles } from './FileCard.styles';
import type { FileCardProps } from './types';

/** A file about to be shared or restored. */
export function FileCard({ name, meta, icon = 'archive', testID }: FileCardProps) {
  return (
    <View
      accessible
      accessibilityLabel={meta ? t('ui.list.item', { title: isolate(name), detail: meta }) : name}
      style={styles.card}
      testID={testID}
    >
      <View style={styles.iconTile}>
        <Icon name={icon} size={22} tone="accent" />
      </View>
      <View style={styles.body}>
        <Text variant="headline">{isolate(name)}</Text>
        {meta ? (
          <Text variant="footnote" tone="secondary">
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
