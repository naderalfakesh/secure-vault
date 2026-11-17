import type { RestoreProgress } from '@/services/BackupService';

import type { RestoreOutcome } from '../backupCopy';

export interface PickedBackup {
  uri: string;
  name: string;
  /** Entries the header declares, the check entry not counted. */
  entries: number;
  created: string;
  /** The header was read but cannot be restored (a newer format): the sheet opens on it. */
  problem?: string;
}

export type InspectOutcome = Extract<RestoreOutcome, { kind: 'inspect' }>;
export type FinalOutcome = Exclude<RestoreOutcome, { kind: 'inspect' }>;

export type Stage =
  | { name: 'inspect'; outcome: InspectOutcome | null }
  | { name: 'running'; progress: RestoreProgress }
  | { name: 'outcome'; outcome: FinalOutcome };

export type RestoreSheetProps = {
  /**
   * The picked file after its header was read; null closes the sheet. The hub
   * keys the sheet by each pick, so each file starts at the inspect step.
   */
  backup: PickedBackup | null;
  /** The sheet was closed: the hub drops the picker's copy. */
  onClose: () => void;
  /** BACKUP_INVALID: close and open the picker again. */
  onChooseAnother: () => void;
  /** The vault was replaced and the index reloaded. */
  onRestored: (entries: number) => void;
  /** The sheet's modal has finished going away (iOS only). */
  onDismissed?: () => void;
};
