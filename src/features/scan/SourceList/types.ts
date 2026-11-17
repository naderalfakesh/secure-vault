import type { IconName } from '@/components/ui';

import type { ScanCopyKey } from '../scanCopy';

export type Source = 'scan' | 'camera' | 'library' | 'files';

/** What went wrong with the last pick, shown inline above the rows. */
export type SourceProblem =
  | { kind: 'unsupported'; name: string }
  | { kind: 'protected'; name: string }
  | { kind: 'failed'; message: string };

/** One source row: its copy, and whether this device can use it. */
export type SourceRow = {
  key: Source;
  icon: IconName;
  title: ScanCopyKey;
  subtitle: ScanCopyKey;
  disabled?: boolean;
};
