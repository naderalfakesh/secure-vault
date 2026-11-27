import type { BiometryType } from '@modules/expo-vault';

export type ShareSheetStep = 'warning' | 'preparing';

export type ShareSheetProps = {
  step: ShareSheetStep | null;
  fileName: string;
  fileMeta: string;
  fileIcon: 'document' | 'pdf' | 'image';
  confirmFirst: boolean;
  biometry: BiometryType;
  busy: boolean;
  onShare: () => void;
  onCancel: () => void;
};
