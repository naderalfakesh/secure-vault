import { Image, type ImageProps } from 'expo-image';

// Memory-only cache prevents expo-image from persisting decrypted plaintext images to disk.
export function DocumentImage(props: Omit<ImageProps, 'cachePolicy'>) {
  return <Image {...props} cachePolicy="memory" />;
}
