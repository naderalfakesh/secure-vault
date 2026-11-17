import { ScrollView, View } from 'react-native';

import { LibraryCard } from '@/features/documents/DocumentCard';
import type { ExpiryDates } from '@/features/documents/library';
import { t } from '@/i18n';
import type { Document } from '@/types';
import { formatExpiry } from '@/utils/format';

import { SectionHeader } from '../SectionHeader';
import { styles } from './ExpiringRail.styles';

type ExpiringRailProps = {
  documents: readonly Document[];
  expiry: ExpiryDates;
  getThumbnail: (id: string) => Promise<string | null>;
  onOpen: (document: Document) => void;
};

/** Documents expiring soon, as cards in a horizontal rail. */
export function ExpiringRail({ documents, expiry, getThumbnail, onOpen }: ExpiringRailProps) {
  return (
    <View style={styles.section}>
      <SectionHeader title={t('library.expiringSoon')} trailing={String(documents.length)} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {documents.map((document) => (
          <LibraryCard
            key={document.id}
            document={document}
            expiry={formatExpiry(expiry.get(document.id) ?? '')}
            onPress={onOpen}
            getThumbnail={getThumbnail}
          />
        ))}
      </ScrollView>
    </View>
  );
}
