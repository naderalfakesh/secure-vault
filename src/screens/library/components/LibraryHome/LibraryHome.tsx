import { ScrollView } from 'react-native';

import type { ExpiryDates } from '@/features/documents/library';
import type { Document, DocumentCategory } from '@/types';

import { CollectionsSection } from '../CollectionsSection';
import { ExpiringRail } from '../ExpiringRail';
import { RecentDocuments } from '../RecentDocuments';
import { styles } from './LibraryHome.styles';

type LibraryHomeProps = {
  expiring: readonly Document[];
  expiry: ExpiryDates;
  recent: readonly Document[];
  counts: Record<DocumentCategory, number>;
  bottomSpace: number;
  onOpen: (document: Document) => void;
  onStartSelecting: (document: Document) => void;
  onBrowse: (collections?: DocumentCategory[]) => void;
};

export function LibraryHome({
  expiring,
  expiry,
  recent,
  counts,
  bottomSpace,
  onOpen,
  onStartSelecting,
  onBrowse,
}: LibraryHomeProps) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {expiring.length > 0 ? (
        <ExpiringRail documents={expiring} expiry={expiry} onOpen={onOpen} />
      ) : null}
      <RecentDocuments
        documents={recent}
        onOpen={onOpen}
        onStartSelecting={onStartSelecting}
        onSeeAll={() => onBrowse()}
      />
      <CollectionsSection counts={counts} onOpen={(category) => onBrowse([category])} />
    </ScrollView>
  );
}
