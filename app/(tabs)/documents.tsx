import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, EmptyState, Icon, IconButton, Screen, Skeleton, Text } from '@/components/ui';
import { CategoryChips } from '@/features/documents/CategoryChips';
import { DocumentCard } from '@/features/documents/DocumentCard';
import { allCategories } from '@/features/documents/categories';
import { useDocuments } from '@/hooks/useDocuments';
import type { Document, DocumentCategory } from '@/types';
import { pluralize } from '@/utils/format';

const COLUMNS = 2;

export default function DocumentsScreen() {
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const { theme } = useUnistyles();
  const {
    documents,
    loading,
    error,
    refreshDocuments,
    filterByCategory,
    selectedCategory,
    getDocumentThumbnail,
    searchDocuments,
  } = useDocuments();

  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Document[] | null>(null);
  const searchRef = useRef<TextInput>(null);

  // Deep links from Home: pick a category or focus the search field.
  useEffect(() => {
    if (params.category && allCategories.includes(params.category as DocumentCategory)) {
      filterByCategory(params.category as DocumentCategory);
    }
    if (params.focus === 'search') {
      const timer = setTimeout(() => searchRef.current?.focus(), 250);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [params.category, params.focus, filterByCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  }, [refreshDocuments]);

  const onSearch = useCallback(
    async (text: string) => {
      setQuery(text);
      setResults(text.trim() ? await searchDocuments(text) : null);
    },
    [searchDocuments],
  );

  const shown = results ?? documents;
  const counts = useMemo(() => {
    const map: Partial<Record<DocumentCategory, number>> = {};
    for (const doc of documents) map[doc.category] = (map[doc.category] ?? 0) + 1;
    return map;
  }, [documents]);

  const openDocument = useCallback(
    (document: Document) => router.push(`/documents/${document.id}`),
    [],
  );
  const openAdd = useCallback(() => router.push('/documents/add'), []);

  const renderItem = useCallback(
    ({ item }: { item: Document }) => (
      <View style={styles.cell}>
        <DocumentCard document={item} onPress={openDocument} getThumbnail={getDocumentThumbnail} />
      </View>
    ),
    [openDocument, getDocumentThumbnail],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text variant="title1" accessibilityRole="header">
              Documents
            </Text>
            <Text variant="footnote" tone="secondary">
              {pluralize(documents.length, 'document')}
            </Text>
          </View>
          <IconButton
            icon="plus"
            accessibilityLabel="Add a document"
            variant="filled"
            onPress={openAdd}
          />
        </View>
        <View style={styles.search}>
          <Icon name="search" size={18} tone="tertiary" />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            placeholder="Search titles, tags, and text"
            placeholderTextColor={theme.colors.textTertiary}
            value={query}
            onChangeText={onSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search documents"
          />
          {query ? (
            <IconButton
              icon="close"
              accessibilityLabel="Clear search"
              size={16}
              onPress={() => onSearch('')}
            />
          ) : null}
        </View>
      </View>

      {results === null ? (
        <CategoryChips selected={selectedCategory} onSelect={filterByCategory} counts={counts} />
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              height={210}
              borderRadius={theme.radii.lg}
              style={styles.skeleton}
            />
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <EmptyState icon="warning" title="Could not open the vault" description={error} />
          <Button label="Try again" variant="secondary" size="md" onPress={refreshDocuments} />
        </View>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={query ? 'search' : 'document'}
          title={
            query
              ? 'No matches'
              : selectedCategory
                ? 'Nothing in this category'
                : 'No documents yet'
          }
          description={
            query
              ? `Nothing matches "${query}" in titles, tags, or extracted text.`
              : 'Scan or import a document and it is encrypted before it touches storage.'
          }
          actionLabel={query ? undefined : 'Add a document'}
          onAction={query ? undefined : openAdd}
        />
      ) : (
        <FlashList
          data={shown}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget,
    paddingLeft: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.xs,
  },
  list: {
    padding: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
  },
  cell: {
    flex: 1,
    padding: theme.spacing.xxs,
  },
  skeletons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.sm,
  },
  skeleton: {
    width: '50%',
    marginBottom: theme.spacing.xs,
  },
  center: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
}));
