import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './SelectionHeader.styles';

type SelectionHeaderProps = {
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onDone: () => void;
};

export function SelectionHeader({ count, allSelected, onToggleAll, onDone }: SelectionHeaderProps) {
  return (
    <View style={styles.bar}>
      <Button
        variant="plain"
        size="md"
        label={allSelected ? t('library.deselectAll') : t('library.selectAll')}
        onPress={onToggleAll}
      />
      <Text variant="headline" accessibilityRole="header" accessibilityLiveRegion="polite" fit>
        {t('library.selected', { count })}
      </Text>
      <Button label={t('common.done')} variant="plain" size="md" onPress={onDone} />
    </View>
  );
}
