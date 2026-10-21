import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Skeleton } from '@/components/ui';

import { DocumentImage } from './DocumentImage';

/** A document's decrypted thumbnail: undefined while decrypting, null when there is none. */
export function useThumbnail(
  id: string,
  getThumbnail: (id: string) => Promise<string | null>,
): string | null | undefined {
  const [loaded, setLoaded] = useState<{ id: string; uri: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    getThumbnail(id)
      .then((uri) => {
        if (active) setLoaded({ id, uri });
      })
      .catch(() => {
        if (active) setLoaded({ id, uri: null });
      });
    return () => {
      active = false;
    };
  }, [id, getThumbnail]);

  return loaded?.id === id ? loaded.uri : undefined;
}

/**
 * What goes inside the paper placeholder: a skeleton while decrypting, the
 * image once ready, and nothing (the placeholder's own lines) without one.
 */
export function thumbnailContent(uri: string | null | undefined, height: number): ReactNode {
  if (uri === undefined) return <Skeleton width="100%" height={height} borderRadius={0} />;
  if (!uri) return undefined;
  return (
    <DocumentImage
      source={{ uri: `file://${uri}` }}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      transition={150}
      accessible={false}
    />
  );
}
