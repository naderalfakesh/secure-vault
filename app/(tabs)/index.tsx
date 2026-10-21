import { router } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import {
  Button,
  Chip,
  CollectionGrid,
  CollectionTile,
  EmptyState,
  Group,
  Icon,
  IconButton,
  ListRow,
  Screen,
  SearchField,
  Sheet,
  Skeleton,
  TAB_BAR_BOTTOM,
  TAB_BAR_HEIGHT,
  Text,
  useToast,
} from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { LibraryCard, LibraryRow } from '@/features/documents/DocumentCard';
import {
  applyFilter,
  collectionScope,
  countByCollection,
  EXPIRING_WINDOW_DAYS,
  type ExpiryDates,
  findSnippet,
  isFiltering,
  type LibraryFilter,
  NO_FILTER,
  recentDocuments,
  resultLine,
  SORT_BUTTON_LABELS,
  SORT_LABELS,
  type SortOrder,
  sortDocuments,
} from '@/features/documents/library';
import { useDeleteWithUndo } from '@/features/documents/useDeleteWithUndo';
import { useHideTabBar } from '@/features/navigation/tabBarVisibility';
import { useDocuments } from '@/hooks/useDocuments';
import { documentService } from '@/services/DocumentService';
import type { Document, DocumentCategory } from '@/types';
import { formatExpiry, pluralize } from '@/utils/format';

/** Every recorded expiry date, so sorting and filtering can use them. */
const ALL_EXPIRY_DAYS = 365 * 200;
/** Skeleton rows only once loading takes longer than this (handover §6 J2). */
const SKELETON_DELAY_MS = 300;
const SEARCH_DEBOUNCE_MS = 150;
const SORTS: SortOrder[] = ['newest', 'oldest', 'title', 'expiry'];

const LOAD_FAILED =
  'Your documents weren’t changed. Try again. If this keeps happening, close and reopen SecureVault.';

export default function LibraryScreen() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { documents, loading, error, refreshDocuments, getDocumentThumbnail, searchDocuments } =
    useDocuments();

  const [expiry, setExpiry] = useState<ExpiryDates>(new Map());
  // Expiry dates up to this day go on the Expiring soon rail.
  const [railCutoff, setRailCutoff] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ query: string; documents: Document[] } | null>(null);
  const [focused, setFocused] = useState(false);
  // "See all" or a collection tile opens the list without a query.
  const [browsing, setBrowsing] = useState(false);
  const [filter, setFilter] = useState<LibraryFilter>(NO_FILTER);
  const [sort, setSort] = useState<SortOrder>('newest');
  const [sheet, setSheet] = useState<'sort' | 'move' | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteWithUndo = useDeleteWithUndo();
  const showSkeleton = useDelayed(loading, SKELETON_DELAY_MS);

  useHideTabBar(selecting);
  useAnnouncement(loading && showSkeleton ? 'Opening your vault' : null);

  // Re-query whenever the list changes; fields are written right after a save.
  useEffect(() => {
    let active = true;
    documentService
      .getExpiring(ALL_EXPIRY_DAYS)
      .then((rows) => {
        if (!active) return;
        setExpiry(new Map(rows.map(({ document, date }) => [document.id, date])));
        setRailCutoff(
          new Date(Date.now() + EXPIRING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [documents]);

  // Full-text search over titles, tags and the text read on this device.
  const text = query.trim();
  useEffect(() => {
    if (!text) return;
    let active = true;
    const timer = setTimeout(() => {
      searchDocuments(text)
        .then((documents) => {
          if (active) setFound({ query: text, documents });
        })
        .catch(() => {
          if (active) setFound({ query: text, documents: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text, searchDocuments]);
  const results = text && found?.query === text ? found.documents : null;

  const searching = query.trim().length > 0;
  const listMode = focused || searching || browsing || isFiltering(filter) || selecting;
  const counts = useMemo(() => countByCollection(documents), [documents]);
  const recent = useMemo(() => recentDocuments(documents), [documents]);
  const shown = useMemo(() => {
    // Search results that have since left the vault are not shown.
    const present = new Set(documents.map((document) => document.id));
    const base = searching
      ? (results ?? []).filter((document) => present.has(document.id))
      : documents;
    return sortDocuments(applyFilter(base, filter, expiry), sort, expiry);
  }, [searching, results, documents, filter, sort, expiry]);
  const expiring = useMemo(
    () =>
      documents
        .filter((document) => (expiry.get(document.id) ?? '9999') <= railCutoff)
        .sort((a, b) => (expiry.get(a.id) ?? '').localeCompare(expiry.get(b.id) ?? '')),
    [documents, expiry, railCutoff],
  );

  // Selected rows that have left the vault drop out of the selection.
  const selected = useMemo(() => {
    const present = new Set(documents.map((document) => document.id));
    return new Set([...picked].filter((id) => present.has(id)));
  }, [picked, documents]);

  // The live region on the count speaks on Android only; iOS is told directly.
  useAnnouncement(selecting ? `${selected.size} selected` : null);

  const openDocument = useCallback((document: Document) => {
    router.push(`/documents/${document.id}`);
  }, []);
  const openAdd = useCallback(() => router.push('/documents/add'), []);

  const leaveList = useCallback(() => {
    setQuery('');
    setBrowsing(false);
    setFilter(NO_FILTER);
    setFocused(false);
  }, []);

  const browse = useCallback((collections: DocumentCategory[] = []) => {
    setBrowsing(true);
    setFilter({ collections, onlyWithExpiry: false });
  }, []);

  const startSelecting = useCallback((document?: Document) => {
    setSelecting(true);
    setSelected(new Set(document ? [document.id] : []));
  }, []);

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((document: Document) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(document.id)) next.delete(document.id);
      else next.add(document.id);
      return next;
    });
  }, []);

  const moveSelected = useCallback(
    async (category: DocumentCategory) => {
      const ids = [...selected];
      setMoving(true);
      let failed = 0;
      for (const id of ids) {
        try {
          if (!(await documentService.updateDocument(id, { category }))) failed += 1;
        } catch {
          failed += 1;
        }
      }
      setMoving(false);
      setSheet(null);
      if (failed > 0) {
        toast.show({
          message: `Couldn’t move ${failed} of ${pluralize(ids.length, 'document')}. The rest are in ${categoryLabel(category)}.`,
          tone: 'danger',
        });
        return;
      }
      stopSelecting();
      toast.show({
        message: `Moved ${pluralize(ids.length, 'document')} to ${categoryLabel(category)}`,
        tone: 'success',
      });
    },
    [selected, toast, stopSelecting],
  );

  const deleteSelected = useCallback(async () => {
    const chosen = documents.filter((document) => selected.has(document.id));
    if (chosen.length === 0) return;
    setDeleting(true);
    await deleteWithUndo(chosen);
    setDeleting(false);
    stopSelecting();
  }, [documents, selected, deleteWithUndo, stopSelecting]);

  const bottomSpace = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 24;
  const allSelected = shown.length > 0 && shown.every((document) => selected.has(document.id));

  // ---- States that replace the whole screen ----

  if (!loading && error) {
    // A fail-closed index is not an empty vault: nothing here suggests adding.
    return (
      <Screen>
        <LargeTitle />
        <View style={styles.center} accessibilityRole="alert">
          <View style={styles.circle('dangerMuted')}>
            <Icon name="warning" size={28} tone="danger" />
          </View>
          <Text variant="title3" align="center">
            Couldn’t load your documents
          </Text>
          <Text variant="subheadline" tone="secondary" align="center">
            {LOAD_FAILED}
          </Text>
          <Text variant="footnote" tone="tertiary" align="center">
            {error}
          </Text>
          <Button label="Try again" variant="tinted" icon="refresh" onPress={refreshDocuments} />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <LargeTitle />
        {showSkeleton ? (
          <View style={styles.inset} accessibilityElementsHidden testID="library-loading">
            <Group>
              {[60, 52, 66].map((width) => (
                <View key={width} style={styles.skeletonRow}>
                  <Skeleton width={44} height={56} borderRadius={8} />
                  <View style={styles.skeletonText}>
                    <Skeleton width={`${width}%`} height={14} />
                    <Skeleton width={`${Math.round(width * 0.66)}%`} height={10} />
                  </View>
                </View>
              ))}
            </Group>
          </View>
        ) : null}
      </Screen>
    );
  }

  if (documents.length === 0) {
    // First run (or after Delete everything): one clear action, nothing else.
    return (
      <Screen>
        <LargeTitle />
        <View style={[styles.center, { paddingBottom: bottomSpace }]}>
          <EmptyState
            icon="scan"
            title="Your vault is empty"
            description="Scan a passport, a lease or a receipt. Each page is encrypted on this device before it’s saved."
            actionLabel="Scan a document"
            onAction={openAdd}
            secondaryActionLabel="Import from Files or Photos"
            onSecondaryAction={openAdd}
          />
        </View>
      </Screen>
    );
  }

  // ---- Header ----

  const header = selecting ? (
    <View style={styles.selectBar}>
      <Button
        variant="plain"
        size="md"
        label={allSelected ? 'Deselect all' : 'Select all'}
        onPress={() =>
          setSelected(allSelected ? new Set() : new Set(shown.map((document) => document.id)))
        }
      />
      <Text variant="headline" accessibilityRole="header" accessibilityLiveRegion="polite">
        {`${selected.size} selected`}
      </Text>
      <Button label="Done" variant="plain" size="md" onPress={stopSelecting} />
    </View>
  ) : (
    <View style={styles.headerBlock}>
      {listMode ? null : (
        <View style={styles.titleRow}>
          <Text variant="largeTitle" accessibilityRole="header" style={styles.titleText}>
            Library
          </Text>
          <Button label="Select" variant="plain" size="md" onPress={() => startSelecting()} />
          <IconButton
            icon="sort"
            accessibilityLabel="Sort and filter"
            onPress={() => setSheet('sort')}
          />
        </View>
      )}
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onCancel={leaveList}
          />
        </View>
        {listMode && !focused ? (
          <Button label="Cancel" variant="plain" size="md" onPress={leaveList} />
        ) : null}
      </View>
      {listMode ? null : (
        <View style={styles.trustLine}>
          <Icon name="lock" size={14} tone="secondary" />
          <Text variant="footnote" tone="secondary">
            {`${pluralize(documents.length, 'document')}, encrypted on this device`}
          </Text>
        </View>
      )}
    </View>
  );

  const sortSheet = (
    <SortSheet
      visible={sheet === 'sort'}
      onClose={() => setSheet(null)}
      sort={sort}
      onSort={setSort}
      filter={filter}
      onFilter={setFilter}
      resultCount={shown.length}
    />
  );

  // ---- List mode: search, a collection, "See all", or multi-select ----

  if (listMode) {
    const scope = collectionScope(filter.collections);
    const listHeader = selecting ? undefined : (
      <View style={styles.listHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
          style={styles.chipScroll}
        >
          <Chip
            label="All"
            selected={filter.collections.length === 0}
            onPress={() => setFilter((value) => ({ ...value, collections: [] }))}
          />
          {allCategories
            .filter((category) => counts[category] > 0 || filter.collections.includes(category))
            .map((category) => (
              <Chip
                key={category}
                label={categoryLabel(category)}
                selected={filter.collections.includes(category)}
                onPress={() =>
                  setFilter((value) => ({
                    ...value,
                    collections:
                      value.collections.length === 1 && value.collections[0] === category
                        ? []
                        : [category],
                  }))
                }
              />
            ))}
        </ScrollView>
        <View style={styles.countRow}>
          <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
            {resultLine(shown.length, searching, filter)}
          </Text>
          <Button
            label={SORT_BUTTON_LABELS[sort]}
            accessibilityLabel={`Sort and filter, ${SORT_BUTTON_LABELS[sort]}`}
            variant="plain"
            size="md"
            icon="sort"
            onPress={() => setSheet('sort')}
          />
        </View>
      </View>
    );

    const waiting = searching && results === null;
    const noMatches = waiting ? undefined : (
      <View style={styles.noMatches}>
        <View style={styles.circle('surfaceMuted')}>
          <Icon name="search" size={28} tone="secondary" />
        </View>
        <Text variant="title3" align="center" accessibilityRole="header">
          {searching
            ? `No matches for “${query.trim()}”${scope ? ` in ${scope}` : ''}`
            : `No documents${scope ? ` in ${scope}` : ''}`}
        </Text>
        <Text variant="subheadline" tone="secondary" align="center">
          Search looks at titles, tags and text read from your documents on this device.
        </Text>
        {isFiltering(filter) ? (
          <Button
            label="Search all collections"
            variant="tinted"
            onPress={() => setFilter(NO_FILTER)}
          />
        ) : null}
      </View>
    );

    return (
      <Screen>
        {header}
        <FlatList
          data={shown}
          keyExtractor={(document) => document.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={noMatches}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: bottomSpace }}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.listRow,
                index === 0 && styles.listRowFirst,
                index === shown.length - 1 && styles.listRowLast,
              ]}
            >
              {index > 0 ? <View style={styles.separator} /> : null}
              <LibraryRow
                document={item}
                getThumbnail={getDocumentThumbnail}
                snippet={searching ? findSnippet(item.ocrText, query) : undefined}
                selectable={selecting}
                selected={selected.has(item.id)}
                onPress={selecting ? toggle : openDocument}
                onLongPress={selecting ? undefined : startSelecting}
              />
            </View>
          )}
        />
        {selecting ? (
          <SelectionBar bottom={insets.bottom}>
            <Button
              label="Move to…"
              variant="plain"
              icon="folder"
              disabled={selected.size === 0 || deleting}
              onPress={() => setSheet('move')}
            />
            <Button
              label={`Delete ${selected.size}`}
              accessibilityLabel={`Delete ${pluralize(selected.size, 'document')}`}
              variant="plainDestructive"
              icon="trash"
              disabled={selected.size === 0 || deleting}
              onPress={deleteSelected}
            />
          </SelectionBar>
        ) : null}
        {sortSheet}
        <MoveSheet
          visible={sheet === 'move'}
          count={selected.size}
          busy={moving}
          onClose={() => setSheet(null)}
          onMove={moveSelected}
        />
      </Screen>
    );
  }

  // ---- Home ----

  return (
    <Screen>
      {header}
      <ScrollView
        contentContainerStyle={[styles.home, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {expiring.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Expiring soon" trailing={String(expiring.length)} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {expiring.map((document) => (
                <LibraryCard
                  key={document.id}
                  document={document}
                  expiry={formatExpiry(expiry.get(document.id) ?? '')}
                  onPress={openDocument}
                  getThumbnail={getDocumentThumbnail}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Recent" action={{ label: 'See all', onPress: () => browse() }} />
          <View style={styles.inset}>
            <Group>
              {recent.map((document) => (
                <LibraryRow
                  key={document.id}
                  document={document}
                  getThumbnail={getDocumentThumbnail}
                  onPress={openDocument}
                  onLongPress={startSelecting}
                />
              ))}
            </Group>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Collections" />
          <View style={styles.inset}>
            <CollectionGrid>
              {allCategories
                .filter((category) => counts[category] > 0)
                .map((category) => (
                  <CollectionTile
                    key={category}
                    name={categoryLabel(category)}
                    count={counts[category]}
                    icon={categoryIcons[category]}
                    onPress={() => browse([category])}
                    testID={`collection-${category}`}
                  />
                ))}
            </CollectionGrid>
          </View>
        </View>
      </ScrollView>
      {sortSheet}
    </Screen>
  );
}

/** True once `active` has stayed true for `delayMs`. */
function useDelayed(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);
  return active && elapsed;
}

function LargeTitle() {
  return (
    <View style={styles.titleRow}>
      <Text variant="largeTitle" accessibilityRole="header" style={styles.titleText}>
        Library
      </Text>
    </View>
  );
}

function SectionHeader({
  title,
  trailing,
  action,
}: {
  title: string;
  trailing?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="title3" accessibilityRole="header">
        {title}
      </Text>
      {trailing ? (
        <Text variant="subheadline" tone="secondary">
          {trailing}
        </Text>
      ) : null}
      {action ? (
        <Button label={action.label} variant="plain" size="md" onPress={action.onPress} />
      ) : null}
    </View>
  );
}

/** Takes the tab bar's place while selecting: Move to… and Delete only (§11.12). */
function SelectionBar({ bottom, children }: { bottom: number; children: ReactNode }) {
  return (
    <View
      style={[
        styles.selectionBar,
        { bottom: bottom > 0 ? Math.max(TAB_BAR_BOTTOM, bottom - 8) : TAB_BAR_BOTTOM / 2 },
      ]}
    >
      {children}
    </View>
  );
}

function SortSheet({
  visible,
  onClose,
  sort,
  onSort,
  filter,
  onFilter,
  resultCount,
}: {
  visible: boolean;
  onClose: () => void;
  sort: SortOrder;
  onSort: (sort: SortOrder) => void;
  filter: LibraryFilter;
  onFilter: (filter: LibraryFilter) => void;
  resultCount: number;
}) {
  // Choices apply as they are made; the button only closes, naming the result.
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Sort and filter"
      detent="large"
      headerAction={{
        label: 'Reset',
        onPress: () => {
          onSort('newest');
          onFilter(NO_FILTER);
        },
      }}
    >
      <ScrollView contentContainerStyle={styles.sheetBody}>
        <Group header="Sort by">
          {SORTS.map((option) => (
            <ListRow
              key={option}
              title={SORT_LABELS[option]}
              checked={sort === option}
              onPress={() => onSort(option)}
            />
          ))}
        </Group>
        <View style={styles.sheetSection}>
          <Text variant="label" tone="tertiary" accessibilityRole="header" style={styles.label}>
            Collections
          </Text>
          <View style={styles.wrapChips}>
            {allCategories.map((category) => {
              const on = filter.collections.includes(category);
              return (
                <Chip
                  key={category}
                  label={categoryLabel(category)}
                  selected={on}
                  onPress={() =>
                    onFilter({
                      ...filter,
                      collections: on
                        ? filter.collections.filter((value) => value !== category)
                        : [...filter.collections, category],
                    })
                  }
                />
              );
            })}
          </View>
        </View>
        <Group>
          <ListRow
            title="Only with an expiry date"
            toggle={{
              value: filter.onlyWithExpiry,
              onValueChange: (onlyWithExpiry) => onFilter({ ...filter, onlyWithExpiry }),
            }}
          />
        </Group>
        <Button label={`Show ${pluralize(resultCount, 'document')}`} onPress={onClose} />
      </ScrollView>
    </Sheet>
  );
}

function MoveSheet({
  visible,
  count,
  busy,
  onClose,
  onMove,
}: {
  visible: boolean;
  count: number;
  busy: boolean;
  onClose: () => void;
  onMove: (category: DocumentCategory) => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Move ${pluralize(count, 'document')} to…`}
      dismissable={!busy}
      detent="large"
    >
      <ScrollView contentContainerStyle={styles.sheetBody}>
        <Group header="Collection" separatorInset="content">
          {allCategories.map((category) => (
            <ListRow
              key={category}
              icon={categoryIcons[category]}
              tint="neutral"
              title={categoryLabel(category)}
              disabled={busy}
              onPress={() => onMove(category)}
            />
          ))}
        </Group>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingStart: theme.layout.titleMargin,
    paddingEnd: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    minHeight: 52,
  },
  titleText: {
    flex: 1,
  },
  headerBlock: {
    paddingBottom: theme.spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  searchField: {
    flex: 1,
  },
  trustLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.layout.titleMargin,
    paddingTop: 10,
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
  },
  home: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  section: {
    gap: theme.spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: theme.touchTarget,
    paddingHorizontal: theme.layout.titleMargin,
  },
  rail: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
  },
  inset: {
    paddingHorizontal: theme.spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xxl,
  },
  circle: (fill: 'dangerMuted' | 'surfaceMuted') => ({
    width: 64,
    height: 64,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors[fill],
  }),
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  skeletonText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  listHeader: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xxs,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chips: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.layout.titleMargin,
    paddingTop: theme.spacing.xs,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.layout.titleMargin,
  },
  listRow: {
    marginHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  listRowFirst: {
    borderTopLeftRadius: theme.radii.group,
    borderTopRightRadius: theme.radii.group,
  },
  listRowLast: {
    borderBottomLeftRadius: theme.radii.group,
    borderBottomRightRadius: theme.radii.group,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginStart: theme.spacing.md,
  },
  noMatches: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: theme.spacing.xxxl,
  },
  selectionBar: {
    position: 'absolute',
    start: theme.spacing.lg,
    end: theme.spacing.lg,
    height: TAB_BAR_HEIGHT,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.elevation.floating,
  },
  sheetBody: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  sheetSection: {
    gap: theme.spacing.xs,
  },
  label: {
    paddingHorizontal: theme.spacing.xxs,
  },
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
}));
