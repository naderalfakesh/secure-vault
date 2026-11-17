import { View } from 'react-native';

import { Button, Icon, IconButton, SearchField, Text } from '@/components/ui';
import { t, tp } from '@/i18n';

import { LibraryTitle } from '../LibraryTitle';
import { styles } from './SearchHeader.styles';

type SearchHeaderProps = {
  query: string;
  onQueryChange: (query: string) => void;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  /** The list replaces the home sections: the title and trust line give way. */
  listMode: boolean;
  documentCount: number;
  onLeaveList: () => void;
  onSelect: () => void;
  onSort: () => void;
};

/** Title with Select and Sort, the search field, and the trust line. */
export function SearchHeader({
  query,
  onQueryChange,
  focused,
  onFocusChange,
  listMode,
  documentCount,
  onLeaveList,
  onSelect,
  onSort,
}: SearchHeaderProps) {
  return (
    <View style={styles.block}>
      {listMode ? null : (
        <LibraryTitle>
          <Button label={t('library.select')} variant="plain" size="md" onPress={onSelect} />
          <IconButton
            icon="sort"
            accessibilityLabel={t('library.sortAndFilter')}
            onPress={onSort}
          />
        </LibraryTitle>
      )}
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <SearchField
            value={query}
            onChangeText={onQueryChange}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            onCancel={onLeaveList}
          />
        </View>
        {listMode && !focused ? (
          <Button label={t('common.cancel')} variant="plain" size="md" onPress={onLeaveList} />
        ) : null}
      </View>
      {listMode ? null : (
        <View style={styles.trustLine}>
          <Icon name="lock" size={14} tone="secondary" />
          <Text variant="footnote" tone="secondary">
            {t('library.trustLine', { documents: tp('format.documents', documentCount) })}
          </Text>
        </View>
      )}
    </View>
  );
}
