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

export type TextReader = (uri: string) => Promise<OcrBlock[]>;
