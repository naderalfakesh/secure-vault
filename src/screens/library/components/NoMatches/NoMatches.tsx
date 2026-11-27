import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { collectionScope, isFiltering, type LibraryFilter } from '@/features/documents/library';
import { t } from '@/i18n';

import { noMatchesTitle } from '../../helpers';
import { StatusIcon } from '../StatusIcon';
import { styles } from './NoMatches.styles';

type NoMatchesProps = {
  query: string;
  filter: LibraryFilter;
  onClearFilter: () => void;
};

export function NoMatches({ query, filter, onClearFilter }: NoMatchesProps) {
  return (
    <View style={styles.container}>
      <StatusIcon icon="search" tone="secondary" />
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
