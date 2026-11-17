import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { collectionScope, isFiltering, type LibraryFilter } from '@/features/documents/library';
import { t } from '@/i18n';

import { noMatchesTitle } from '../../helpers';
import { StatusIcon } from '../StatusIcon';
import { styles } from './NoMatches.styles';

type NoMatchesProps = {
  /** The trimmed search, or empty when browsing. */
  query: string;
  filter: LibraryFilter;
  onClearFilter: () => void;
};

/** The empty list: nothing matched the search or the chosen collections. */
export function NoMatches({ query, filter, onClearFilter }: NoMatchesProps) {
  return (
    <View style={styles.container}>
      <StatusIcon icon="search" tone="secondary" />
      {/* It can quote the search, which may be one long token: it wraps instead. */}
      <Text variant="title3" align="center" accessibilityRole="header" fit={false}>
        {noMatchesTitle(query, collectionScope(filter.collections))}
      </Text>
      <Text variant="subheadline" tone="secondary" align="center">
        {t('library.searchHint')}
      </Text>
      {isFiltering(filter) ? (
        <Button label={t('library.searchAll')} variant="tinted" onPress={onClearFilter} />
      ) : null}
    </View>
  );
}
