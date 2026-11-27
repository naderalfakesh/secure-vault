import type { IconName } from '@/components/ui';

import type { ScanCopyKey } from '../scanCopy';

export type Source = 'scan' | 'camera' | 'library' | 'files';

export type SourceProblem =
  | { kind: 'unsupported'; name: string }
  | { kind: 'protected'; name: string }
  | { kind: 'failed'; message: string };

export type SourceRow = {
  key: Source;
  icon: IconName;
  title: ScanCopyKey;
  subtitle: ScanCopyKey;
  disabled?: boolean;
};
