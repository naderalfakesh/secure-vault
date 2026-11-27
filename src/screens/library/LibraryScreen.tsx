import { router } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui';
import { useDocumentList } from '@/features/documents/hooks/useDocumentList';
import { indexOrder, NO_FILTER } from '@/features/documents/library';
import { tabBarClearance } from '@/features/navigation/tabBarClearance';
import { useHideTabBar } from '@/features/navigation/tabBarVisibility';
import { useDelayed } from '@/hooks/useDelayed';
import type { Document } from '@/types';

import {
  DocumentList,
  LibraryHome,
  LibraryStatus,
  ListFilters,
  MoveSheet,
  NoMatches,
  SearchHeader,
  SelectionBar,
  SelectionHeader,
  SortSheet,
} from './components';
import { SKELETON_DELAY_MS } from './constants';
import { useBulkActions } from './hooks/useBulkActions';
import { useExpiryDates } from './hooks/useExpiryDates';
import { useIndexOrder } from './hooks/useIndexOrder';
import { useLibraryAnnouncements } from './hooks/useLibraryAnnouncements';
import { useLibraryBrowse } from './hooks/useLibraryBrowse';
import { useLibraryLists } from './hooks/useLibraryLists';
import { useLibrarySearch } from './hooks/useLibrarySearch';
import { useSelection } from './hooks/useSelection';

const openDocument = (document: Document) => router.push(`/documents/${document.id}`);
const openAdd = () => router.push('/documents/add');

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { documents, loading, error, refresh } = useDocumentList();
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

  const { counts, recent, expiring, shown } = useLibraryLists({
    documents,
    expiry,
    railCutoff,
    hits: search.searching ? (search.results?.hits ?? []) : null,
    ordered,
    filter,
    sort,
  });

  const allSelected = shown.length > 0 && shown.every((document) => selected.has(document.id));
  const { pick } = selection;
  const toggleAll = useCallback(() => pick(allSelected ? [] : shown), [pick, allSelected, shown]);

  const listMode = browse.listing || selecting;
  const bottomSpace = tabBarClearance(insets.bottom);

  if (!loading && error) {
    return <LibraryStatus status="failed" error={error} onRetry={refresh} />;
  }
  if (loading) return <LibraryStatus status="loading" showSkeleton={showSkeleton} />;
  if (documents.length === 0) {
    return <LibraryStatus status="empty" bottomSpace={bottomSpace} onAdd={openAdd} />;
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
          onSort={browse.openSortSheet}
        />
      )}

      {listMode ? (
        <DocumentList
          documents={shown}
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
                onSort={browse.openSortSheet}
              />
            )
          }
          empty={
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
          onMove={browse.openMoveSheet}
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
