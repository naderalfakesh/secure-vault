import type { IconName } from '../Icon';

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  description: string;
  /** Primary action, e.g. "Scan a document". */
  actionLabel?: string;
  onAction?: () => void;
  /** Optional secondary action, e.g. "Import from Files or Photos". */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  testID?: string;
};
