import { ScrollView, View } from 'react-native';

import { Button, Chip, Text } from '@/components/ui';
import { allCategories, categoryLabel } from '@/features/documents/categories';
import {
  type LibraryFilter,
  resultLine,
  sortButtonLabel,
  type SortOrder,
} from '@/features/documents/library';
import { t } from '@/i18n';
import type { DocumentCategory } from '@/types';

import { styles } from './ListFilters.styles';
import { soleCollection } from '../../helpers';

type ListFiltersProps = {
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  counts: Record<DocumentCategory, number>;
  resultCount: number;
  searching: boolean;
  sort: SortOrder;
  onSort: () => void;
};

export function ListFilters({
  filter,
  onFilterChange,
  counts,
  resultCount,
  searching,
  sort,
  onSort,
}: ListFiltersProps) {
  const shown = allCategories.filter(
    (category) => counts[category] > 0 || filter.collections.includes(category),
  );

  return (
    <View style={styles.header}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
      >
        <Chip
          label={t('library.all')}
          selected={filter.collections.length === 0}
          onPress={() => onFilterChange({ ...filter, collections: [] })}
        />
        {shown.map((category) => (
          <Chip
            key={category}
            label={categoryLabel(category)}
            selected={filter.collections.includes(category)}
            onPress={() => onFilterChange(soleCollection(filter, category))}
          />
        ))}
      </ScrollView>
      <View style={styles.countRow}>
        <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
          {resultLine(resultCount, searching, filter)}
        </Text>
        <Button
          label={sortButtonLabel(sort)}
          accessibilityLabel={t('library.sortButton.label', { sort: sortButtonLabel(sort) })}
          variant="plain"
          size="md"
          icon="sort"
          onPress={onSort}
        />
      </View>
    </View>
  );
}
