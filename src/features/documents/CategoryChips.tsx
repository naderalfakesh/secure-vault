import { useEffect, useRef } from 'react';
import { type LayoutChangeEvent, ScrollView, View } from 'react-native';
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
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<string, number>>>({});

  // A category chosen from Home can sit past the right edge; bring it into view.
  useEffect(() => {
    const x = offsets.current[selected ?? 'all'];
    if (x !== undefined) scroll.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
  }, [selected]);

  const remember = (key: string, event: LayoutChangeEvent) => {
    offsets.current[key] = event.nativeEvent.layout.x;
  };

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={scrollStyle}
      contentContainerStyle={styles.content}
      accessibilityRole="tablist"
    >
      <View onLayout={(event) => remember('all', event)}>
        <Chip label="All" icon="grid" selected={selected === null} onPress={() => onSelect(null)} />
      </View>
      {allCategories.map((category) => (
        <View key={category} onLayout={(event) => remember(category, event)}>
          <Chip
            label={categoryLabel(category)}
            icon={categoryIcons[category]}
            selected={selected === category}
            count={counts?.[category]}
            onPress={() => onSelect(category)}
          />
        </View>
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
