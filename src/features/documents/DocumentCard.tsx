import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { DocumentCard as CardView, Skeleton } from '@/components/ui';
import type { Document } from '@/types';
import { formatDate, formatFileSize } from '@/utils/format';

import { categoryLabel } from './categories';
import { DocumentImage } from './DocumentImage';

export type DocumentCardProps = {
  document: Document;
  onPress: (document: Document) => void;
  getThumbnail: (id: string) => Promise<string | null>;
  /** Compact variant for horizontal rows. */
  compact?: boolean;
};

/** Loads a document's decrypted thumbnail into the design-system card. */
export function DocumentCard({
  document,
  onPress,
  getThumbnail,
  compact = false,
}: DocumentCardProps) {
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getThumbnail(document.id)
      .then((uri) => {
        if (active) setThumbnail(uri);
      })
      .catch(() => {
        if (active) setThumbnail(null);
      });
    return () => {
      active = false;
    };
  }, [document.id, getThumbnail]);

  const meta = compact
    ? formatDate(document.createdAt)
    : `${formatDate(document.createdAt)} · ${formatFileSize(document.fileSize)}`;

  // Without a thumbnail the card shows its scanned-paper placeholder.
  return (
    <CardView
      title={document.title}
      meta={meta}
      layout={compact ? 'rail' : 'grid'}
      accessibilityLabel={`${document.title}, ${categoryLabel(document.category)}, ${formatDate(document.createdAt)}`}
      onPress={() => onPress(document)}
      thumbnail={
        thumbnail === undefined ? (
          <Skeleton width="100%" height={compact ? 92 : 120} borderRadius={0} />
        ) : thumbnail ? (
          <DocumentImage
            source={{ uri: `file://${thumbnail}` }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={150}
            accessible={false}
          />
        ) : undefined
      }
    />
  );
}
