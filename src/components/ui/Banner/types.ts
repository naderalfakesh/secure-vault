import type { IconName } from '../Icon';

export type BannerAction = { label: string; onPress: () => void };

export type BannerProps = {
  icon?: IconName;
  /** Bold lead sentence, e.g. "SecureVault locked while you were sharing." */
  lead: string;
  message?: string;
  /** Primary action first, e.g. "Share again". */
  actions?: readonly BannerAction[];
  /** Adds a "Dismiss" action. The banner has no timer; it stays until dismissed. */
  onDismiss?: () => void;
  testID?: string;
};
