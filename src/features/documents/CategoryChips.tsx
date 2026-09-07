import { ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Chip } from '@/components/ui';
import type { DocumentCategory } from '@/types';

import { allCategories, categoryIcons, categoryLabel } from './categories';

// Plain object on purpose: a horizontal ScrollView must not take flex height.
const scrollStyle = { flexGrow: 0, height: 52 } as const;

export type CategoryChipsProps = {
  selected: DocumentCategory | null;
  onSelect: (category: DocumentCategory | null) => void;
  counts?: Partial<Record<DocumentCategory, number>>;
};

export function CategoryChips({ selected, onSelect, counts }: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={scrollStyle}
      contentContainerStyle={styles.content}
      accessibilityRole="tablist"
    >
      <Chip label="All" icon="grid" selected={selected === null} onPress={() => onSelect(null)} />
      {allCategories.map((category) => (
        <Chip
          key={category}
          label={categoryLabel(category)}
          icon={categoryIcons[category]}
          selected={selected === category}
          count={counts?.[category]}
          onPress={() => onSelect(category)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
}));
