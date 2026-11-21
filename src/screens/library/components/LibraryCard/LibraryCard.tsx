import { DocumentCard } from '@/components/ui';
import { categoryLabel } from '@/features/documents/categories';
import { DocumentThumbnail } from '@/features/documents/DocumentThumbnail';
import { useThumbnail } from '@/features/documents/hooks/useThumbnail';
import { t } from '@/i18n';
import { isolate } from '@/utils/bidi';

import { THUMBNAIL_HEIGHT } from './constants';
import type { LibraryCardProps } from './types';

/** A card on the Expiring soon rail, with the decrypted thumbnail. */
export function LibraryCard({ document, expiry, onPress }: LibraryCardProps) {
  const uri = useThumbnail(document.id);

  return (
    <DocumentCard
      title={document.title}
      expiry={expiry}
      layout="rail"
      accessibilityLabel={t('library.card.label', {
        title: isolate(document.title),
        collection: categoryLabel(document.category),
        expiry,
      })}
      onPress={() => onPress(document)}
      thumbnail={
        uri === null ? undefined : <DocumentThumbnail uri={uri} height={THUMBNAIL_HEIGHT} />
      }
    />
  );
}
