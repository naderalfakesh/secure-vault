import { StyleSheet } from 'react-native-unistyles';

import { Skeleton } from '@/components/ui';

import { DocumentImage } from '../DocumentImage';
import type { DocumentThumbnailProps } from './types';

/**
 * What goes inside the paper placeholder: a skeleton while decrypting, the
 * image once ready, and nothing (the placeholder's own lines) without one.
 */
export function DocumentThumbnail({ uri, height }: DocumentThumbnailProps) {
  if (uri === undefined) return <Skeleton width="100%" height={height} borderRadius={0} />;
  if (!uri) return null;
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
