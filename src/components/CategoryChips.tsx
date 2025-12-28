import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  DocumentCategory,
  DocumentCategoryLabels,
  DocumentCategoryIcons,
} from '../types';

interface CategoryChipsProps {
  selectedCategory: DocumentCategory | null;
  onSelectCategory: (category: DocumentCategory | null) => void;
}

export function CategoryChips({
  selectedCategory,
  onSelectCategory,
}: CategoryChipsProps) {
  const categories = Object.values(DocumentCategory);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[
            styles.chip,
            selectedCategory === null && styles.chipSelected,
          ]}
          onPress={() => onSelectCategory(null)}
        >
          <Text style={styles.chipIcon}>📁</Text>
          <Text
            style={[
              styles.chipText,
              selectedCategory === null && styles.chipTextSelected,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.chip,
              selectedCategory === category && styles.chipSelected,
            ]}
            onPress={() => onSelectCategory(category)}
          >
            <Text style={styles.chipIcon}>
              {DocumentCategoryIcons[category]}
            </Text>
            <Text
              style={[
                styles.chipText,
                selectedCategory === category && styles.chipTextSelected,
              ]}
            >
              {DocumentCategoryLabels[category]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#4361ee',
    borderColor: '#4361ee',
  },
  chipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  chipText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
});

export default CategoryChips;
