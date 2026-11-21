import { useEffect, useState } from 'react';

import { getThumbnail } from '../thumbnails';

/** A document's decrypted thumbnail: undefined while decrypting, null when there is none. */
export function useThumbnail(id: string): string | null | undefined {
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
  }, [id]);

  return loaded?.id === id ? loaded.uri : undefined;
}
