import type { BiometryType } from '@modules/expo-vault';

export type ShareSheetStep = 'warning' | 'preparing';

export type ShareSheetProps = {
  /** null hides the sheet. */
  step: ShareSheetStep | null;
  /** The one document being shared. */
  fileName: string;
  fileMeta: string;
  fileIcon: 'document' | 'pdf' | 'image';
  /** Confirm before sharing: the primary button asks for biometrics first. */
  confirmFirst: boolean;
  biometry: BiometryType;
  /** True while the biometric step-up or the copy is under way. */
  busy: boolean;
  onShare: () => void;
  /** Warning: nothing was made. Preparing: the partial copy is removed. */
  onCancel: () => void;
};
