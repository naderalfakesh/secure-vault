export interface OcrBlock {
  text: string;
  lines: string[];
  boundingBox?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export interface OcrResult {
  text: string;
  blocks: OcrBlock[];
}

/** Reads the blocks of text in the image at a `file://` URI, in reading order. */
export type TextReader = (uri: string) => Promise<OcrBlock[]>;
