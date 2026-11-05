import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t } from '@/i18n';
import { isolate } from '@/utils/bidi';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type FileCardProps = {
  /** File name; isolated so mixed-direction names stay readable. */
  name: string;
  /** e.g. "48 entries · made 3 Oct 2026". */
  meta?: string;
  icon?: IconName;
  testID?: string;
};

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

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 14,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surfaceMuted,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
  },
  body: {
    flex: 1,
    gap: 2,
  },
}));
