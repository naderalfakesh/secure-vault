export type Destination = 'share' | 'save';

export type Stage =
  | { name: 'form' }
  | { name: 'busy'; done: number; total: number }
  | { name: 'error'; message: string };

export type CreateBackupSheetProps = {
  visible: boolean;
  onClose: () => void;
  onShared: (date: Date) => void;
};
