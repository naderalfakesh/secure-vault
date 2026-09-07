import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDocuments } from '../../src/hooks';
import {
  DocumentCard,
  CategoryChips,
  EmptyState,
  DocumentListSkeleton,
} from '../../src/components';
import type { Document } from '../../src/types';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 2;
const CARD_MARGIN = 4;
const CARD_WIDTH = (width - 32 - CARD_MARGIN * 4) / NUM_COLUMNS;

export default function DocumentsListScreen() {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Document[] | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  }, [refreshDocuments]);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        const results = await searchDocuments(query);
        setSearchResults(results);
      } else {
        setSearchResults(null);
      }
    },
    [searchDocuments],
  );

  const handleDocumentPress = useCallback((document: Document) => {
    router.push(`/documents/${document.id}`);
  }, []);

  const handleAddDocument = useCallback(() => {
    router.push('/documents/add');
  }, []);

  const displayDocuments = searchResults ?? documents;

  const renderDocument = useCallback(
    ({ item }: { item: Document }) => (
      <View style={{ width: CARD_WIDTH }}>
        <DocumentCard
          document={item}
          onPress={handleDocumentPress}
          getThumbnail={getDocumentThumbnail}
        />
      </View>
    ),
    [handleDocumentPress, getDocumentThumbnail],
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {showSearch ? (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor="#6c757d"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSearchResults(null);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Documents</Text>
            <Text style={styles.headerSubtitle}>
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={() => setShowSearch(true)}>
              <Text style={styles.headerButtonIcon}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/settings')}>
              <Text style={styles.headerButtonIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {renderHeader()}
        <CategoryChips selectedCategory={selectedCategory} onSelectCategory={filterByCategory} />
        <DocumentListSkeleton count={6} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {renderHeader()}
        <EmptyState icon="⚠️" title="Something went wrong" subtitle={error} />
        <TouchableOpacity style={styles.retryButton} onPress={refreshDocuments}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {renderHeader()}

      {!showSearch && (
        <CategoryChips selectedCategory={selectedCategory} onSelectCategory={filterByCategory} />
      )}

      {displayDocuments.length === 0 ? (
        <EmptyState
          icon={searchQuery ? '🔍' : '📁'}
          title={searchQuery ? 'No results found' : 'No Documents Yet'}
          subtitle={
            searchQuery
              ? `No documents match "${searchQuery}"`
              : 'Add your first document by tapping the + button below'
          }
        />
      ) : (
        <FlatList
          data={displayDocuments}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4361ee']}
              tintColor="#4361ee"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleAddDocument} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonIcon: {
    fontSize: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a2e',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#4361ee',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
  },
  retryButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 40,
    marginBottom: 40,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4361ee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
    marginTop: -2,
  },
});
