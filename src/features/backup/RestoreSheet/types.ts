import type { RestoreProgress } from '@/services/BackupService';

import type { RestoreOutcome } from '../backupCopy';

export interface PickedBackup {
  uri: string;
  name: string;
  entries: number;
  created: string;
  problem?: string;
}

export type InspectOutcome = Extract<RestoreOutcome, { kind: 'inspect' }>;
export type FinalOutcome = Exclude<RestoreOutcome, { kind: 'inspect' }>;

export type Stage =
  | { name: 'inspect'; outcome: InspectOutcome | null }
  | { name: 'running'; progress: RestoreProgress }
  | { name: 'outcome'; outcome: FinalOutcome };

export type RestoreSheetProps = {
  backup: PickedBackup | null;
  onClose: () => void;
  onChooseAnother: () => void;
  onRestored: (entries: number) => void;
  onDismissed?: () => void;
};
