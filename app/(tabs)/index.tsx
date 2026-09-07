import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Card, EmptyState, Icon, Screen, Text } from '@/components/ui';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { DocumentCard } from '@/features/documents/DocumentCard';
import { useDocuments } from '@/hooks/useDocuments';
import type { Document, DocumentCategory } from '@/types';
import { pluralize } from '@/utils/format';

const RECENT_LIMIT = 6;

export default function HomeScreen() {
  const { documents, loading, getDocumentThumbnail } = useDocuments();

  const recent = useMemo(
    () =>
      [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_LIMIT),
    [documents],
  );

  const counts = useMemo(() => {
    const result = {} as Record<DocumentCategory, number>;
    for (const category of allCategories) result[category] = 0;
    for (const doc of documents) result[doc.category] += 1;
    return result;
  }, [documents]);

  const openDocument = (document: Document) => router.push(`/documents/${document.id}`);
  const openAdd = () => router.push('/documents/add');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="largeTitle" accessibilityRole="header">
              SecureVault
            </Text>
            <Text variant="subheadline" tone="secondary">
              {loading ? 'Opening your vault' : pluralize(documents.length, 'document')}, all on
              this device
            </Text>
          </View>
          <View style={styles.badge}>
            <Icon name="shield" size={22} tone="accent" />
          </View>
        </View>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search documents"
          onPress={() => router.push('/documents?focus=search')}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <Icon name="search" size={18} tone="tertiary" />
          <Text variant="body" tone="tertiary">
            Search titles, tags, and text
          </Text>
        </Pressable>

        {!loading && documents.length === 0 ? (
          <Card>
            <EmptyState
              icon="scan"
              title="Scan your first document"
              description="Passports, IDs, insurance cards, receipts. Everything is encrypted before it is stored."
              actionLabel="Add a document"
              onAction={openAdd}
            />
          </Card>
        ) : (
          <Button
            label="Scan a document"
            onPress={openAdd}
            leading={<Icon name="scan" size={18} tone="inverse" />}
          />
        )}

        {recent.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="title3" accessibilityRole="header">
                Recent
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/documents')}
                hitSlop={8}
              >
                <Text variant="subheadline" tone="accent">
                  See all
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
            >
              {recent.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  onPress={openDocument}
                  getThumbnail={getDocumentThumbnail}
                  compact
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="title3" accessibilityRole="header">
            Categories
          </Text>
          <View style={styles.grid}>
            {allCategories.map((category) => (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={`${categoryLabel(category)}, ${pluralize(counts[category], 'document')}`}
                onPress={() => router.push(`/documents?category=${category}`)}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                <Icon name={categoryIcons[category]} size={22} tone="accent" />
                <Text variant="subheadline" numberOfLines={1} style={styles.tileLabel}>
                  {categoryLabel(category)}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {counts[category]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget + 4,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  pressed: { opacity: 0.8 },
  section: {
    gap: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    gap: theme.spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tile: {
    width: '30%',
    flexGrow: 1,
    minHeight: 96,
    padding: theme.spacing.sm,
    gap: theme.spacing.xxs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  tileLabel: {
    fontWeight: '600',
  },
}));
