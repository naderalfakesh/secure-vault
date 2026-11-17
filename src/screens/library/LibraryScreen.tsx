import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui';
import {
  countByCollection,
  indexOrder,
  NO_FILTER,
  recentDocuments,
} from '@/features/documents/library';
import { useHideTabBar } from '@/features/navigation/tabBarVisibility';
import { useDelayed } from '@/hooks/useDelayed';
import { useDocuments } from '@/hooks/useDocuments';
import type { Document } from '@/types';

import {
  DocumentList,
  EmptyLibrary,
  LibraryHome,
  LibrarySkeleton,
  LibraryTitle,
  ListFilters,
  LoadFailed,
  MoveSheet,
  NoMatches,
  SearchHeader,
  SelectionBar,
  SelectionHeader,
  SortSheet,
} from './components';
import { SKELETON_DELAY_MS } from './constants';
import { expiringDocuments, listBottomSpace, visibleDocuments } from './helpers';
import { useBulkActions } from './hooks/useBulkActions';
import { useExpiryDates } from './hooks/useExpiryDates';
import { useIndexOrder } from './hooks/useIndexOrder';
import { useLibraryAnnouncements } from './hooks/useLibraryAnnouncements';
import { useLibraryBrowse } from './hooks/useLibraryBrowse';
import { useLibrarySearch } from './hooks/useLibrarySearch';
import { useSelection } from './hooks/useSelection';

const openDocument = (document: Document) => router.push(`/documents/${document.id}`);
const openAdd = () => router.push('/documents/add');

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { documents, loading, error, refreshDocuments, getDocumentThumbnail } = useDocuments();
  const browse = useLibraryBrowse();
  const { filter, sort } = browse;
  const order = indexOrder(sort);

  const { expiry, railCutoff } = useExpiryDates(documents);
  const search = useLibrarySearch(browse.query, order, documents);
  const ordered = useIndexOrder(order, documents);
  const selection = useSelection(documents);
  const { selecting, selected } = selection;
  const actions = useBulkActions({
    documents,
    selected,
    onDone: selection.stop,
    onMoved: browse.closeSheet,
  });
  const showSkeleton = useDelayed(loading, SKELETON_DELAY_MS);

  useHideTabBar(selecting);
  useLibraryAnnouncements({
    loading,
    showSkeleton,
    error,
    selecting,
    selectedCount: selected.size,
  });

  const counts = useMemo(() => countByCollection(documents), [documents]);
  const recent = useMemo(() => recentDocuments(documents), [documents]);
  const expiring = useMemo(
    () => expiringDocuments(documents, expiry, railCutoff),
    [documents, expiry, railCutoff],
  );
  const shown = useMemo(() => {
    const base = search.searching
      ? (search.results?.hits ?? []).map((hit) => hit.document)
      : (ordered ?? documents);
    return visibleDocuments(base, documents, filter, expiry, sort);
  }, [search.searching, search.results, ordered, documents, filter, expiry, sort]);

  const allSelected = shown.length > 0 && shown.every((document) => selected.has(document.id));
  const { pick } = selection;
  const toggleAll = useCallback(() => pick(allSelected ? [] : shown), [pick, allSelected, shown]);

  const listMode = browse.listing || selecting;
  const bottomSpace = listBottomSpace(insets.bottom);

  // States that replace the whole screen.
  if (!loading && error) {
    return (
      <Screen>
        <LibraryTitle />
        <LoadFailed error={error} onRetry={refreshDocuments} />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen>
        <LibraryTitle />
        {showSkeleton ? <LibrarySkeleton /> : null}
      </Screen>
    );
  }
  if (documents.length === 0) {
    return (
      <Screen>
        <LibraryTitle />
        <EmptyLibrary bottomSpace={bottomSpace} onAdd={openAdd} />
      </Screen>
    );
  }

  return (
    <Screen>
      {selecting ? (
        <SelectionHeader
          count={selected.size}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          onDone={selection.stop}
        />
      ) : (
        <SearchHeader
          query={browse.query}
          onQueryChange={browse.setQuery}
          focused={browse.focused}
          onFocusChange={browse.setFocused}
          listMode={listMode}
          documentCount={documents.length}
          onLeaveList={browse.leaveList}
          onSelect={() => selection.start()}
          onSort={() => browse.setSheet('sort')}
        />
      )}

      {listMode ? (
        <DocumentList
          documents={shown}
          getThumbnail={getDocumentThumbnail}
          snippets={search.searching ? search.snippets : undefined}
          header={
            selecting ? undefined : (
              <ListFilters
                filter={filter}
                onFilterChange={browse.setFilter}
                counts={counts}
                resultCount={shown.length}
                searching={search.searching}
                sort={sort}
                onSort={() => browse.setSheet('sort')}
              />
            )
          }
          empty={
            // No verdict while the first answer to a search is on its way.
            search.searching && search.results === null ? undefined : (
              <NoMatches
                query={search.searching ? search.text : ''}
                filter={filter}
                onClearFilter={() => browse.setFilter(NO_FILTER)}
              />
            )
          }
          bottomSpace={bottomSpace}
          selecting={selecting}
          selected={selected}
          onOpen={openDocument}
          onToggle={selection.toggle}
          onStartSelecting={selection.start}
        />
      ) : (
        <LibraryHome
          expiring={expiring}
          expiry={expiry}
          recent={recent}
          counts={counts}
          bottomSpace={bottomSpace}
          getThumbnail={getDocumentThumbnail}
          onOpen={openDocument}
          onStartSelecting={selection.start}
          onBrowse={browse.browse}
        />
      )}

      {selecting ? (
        <SelectionBar
          insetBottom={insets.bottom}
          count={selected.size}
          busy={actions.deleting}
          onMove={() => browse.setSheet('move')}
          onDelete={actions.deleteSelected}
        />
      ) : null}
      <SortSheet
        visible={browse.sheet === 'sort'}
        onClose={browse.closeSheet}
        sort={sort}
        onSortChange={browse.setSort}
        filter={filter}
        onFilterChange={browse.setFilter}
        resultCount={shown.length}
      />
      {listMode ? (
        <MoveSheet
          visible={browse.sheet === 'move'}
          count={selected.size}
          busy={actions.moving}
          onClose={browse.closeSheet}
          onMove={actions.moveSelected}
        />
      ) : null}
    </Screen>
  );
}
