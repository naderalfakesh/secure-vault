// Where a finished backup goes. Android offers the system save screen first,
// for a phone without a Files app; iOS's share sheet has Save to Files.
export type Destination = 'share' | 'save';

export type Stage =
  | { name: 'form' }
  | { name: 'busy'; done: number; total: number }
  | { name: 'error'; message: string };

export type CreateBackupSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The backup reached the share sheet or was saved, and the vault stayed unlocked. */
  onShared: (date: Date) => void;
};
