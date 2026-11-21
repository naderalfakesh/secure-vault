export type DocumentThumbnailProps = {
  /** Undefined while decrypting, null or empty when the document has none. */
  uri: string | null | undefined;
  height: number;
};
