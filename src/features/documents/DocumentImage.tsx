import { Image, type ImageProps } from 'expo-image';

/**
 * expo-image for decrypted document content. The library's default disk cache
 * would keep a plaintext copy of every image after the decrypted file is gone,
 * so these are cached in memory only; `DocumentService.clearCache` empties both
 * caches when the vault locks.
 */
export function DocumentImage(props: Omit<ImageProps, 'cachePolicy'>) {
  return <Image {...props} cachePolicy="memory" />;
}
