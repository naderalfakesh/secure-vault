import { View } from 'react-native';

import { Group } from '@/components/ui';
import { t } from '@/i18n';
import type { Document } from '@/types';

import { LibraryRow } from '../LibraryRow';
import { SectionHeader } from '../SectionHeader';
import { styles } from './RecentDocuments.styles';

type RecentDocumentsProps = {
  documents: readonly Document[];
  onOpen: (document: Document) => void;
  onStartSelecting: (document: Document) => void;
  onSeeAll: () => void;
};

/** The last few documents added, with "See all". */
export function RecentDocuments({
  documents,
  onOpen,
  onStartSelecting,
  onSeeAll,
}: RecentDocumentsProps) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('library.recent')}
        action={{ label: t('library.seeAll'), onPress: onSeeAll }}
      />
      <View style={styles.inset}>
        <Group>
          {documents.map((document) => (
            <LibraryRow
              key={document.id}
              document={document}
              onPress={onOpen}
              onLongPress={onStartSelecting}
            />
          ))}
        </Group>
      </View>
    </View>
  );
}
