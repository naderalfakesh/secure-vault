import { ScrollView, View } from 'react-native';

import { Button, Chip, Group, ListRow, Sheet, Text } from '@/components/ui';
import { allCategories, categoryLabel } from '@/features/documents/categories';
import {
  type LibraryFilter,
  NO_FILTER,
  sortLabel,
  type SortOrder,
} from '@/features/documents/library';
import { t, tp } from '@/i18n';

import { styles } from './SortSheet.styles';
import { SORTS } from '../../constants';
import { toggleCollection } from '../../helpers';

type SortSheetProps = {
  visible: boolean;
  onClose: () => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  resultCount: number;
};

export function SortSheet({
  visible,
  onClose,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  resultCount,
}: SortSheetProps) {
  const reset = () => {
    onSortChange('newest');
    onFilterChange(NO_FILTER);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('library.sortAndFilter')}
      scroll={false}
      headerAction={{ label: t('library.sheet.reset'), onPress: reset }}
    >
      <ScrollView style={styles.scroller} contentContainerStyle={styles.body}>
        <Group header={t('library.sheet.sortBy')}>
          {SORTS.map((option) => (
            <ListRow
              key={option}
              title={sortLabel(option)}
              checked={sort === option}
              onPress={() => onSortChange(option)}
            />
          ))}
        </Group>
        <View style={styles.section}>
          <Text variant="label" tone="tertiary" accessibilityRole="header" style={styles.label}>
            {t('library.collections')}
          </Text>
          <View style={styles.chips}>
            {allCategories.map((category) => (
              <Chip
                key={category}
                label={categoryLabel(category)}
                selected={filter.collections.includes(category)}
                onPress={() => onFilterChange(toggleCollection(filter, category))}
              />
            ))}
          </View>
        </View>
        <Group>
          <ListRow
            title={t('library.sheet.onlyWithExpiry')}
            toggle={{
              value: filter.onlyWithExpiry,
              onValueChange: (onlyWithExpiry) => onFilterChange({ ...filter, onlyWithExpiry }),
            }}
          />
        </Group>
        <Button
          label={t('library.sheet.show', { documents: tp('format.documents', resultCount) })}
          onPress={onClose}
        />
      </ScrollView>
    </Sheet>
  );
}
