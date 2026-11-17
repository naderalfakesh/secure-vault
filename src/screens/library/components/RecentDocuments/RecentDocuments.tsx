import { View } from 'react-native';

import { Group } from '@/components/ui';
import { LibraryRow } from '@/features/documents/DocumentCard';
import { t } from '@/i18n';
import type { Document } from '@/types';

import { SectionHeader } from '../SectionHeader';
import { styles } from './RecentDocuments.styles';

type RecentDocumentsProps = {
  documents: readonly Document[];
  getThumbnail: (id: string) => Promise<string | null>;
  onOpen: (document: Document) => void;
  onStartSelecting: (document: Document) => void;
  onSeeAll: () => void;
};

/** The last few documents added, with "See all". */
export function RecentDocuments({
  documents,
  getThumbnail,
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
              getThumbnail={getThumbnail}
              onPress={onOpen}
              onLongPress={onStartSelecting}
            />
          ))}
        </Group>
      </View>
    </View>
  );
}
