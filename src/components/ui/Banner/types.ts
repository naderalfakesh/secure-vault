import type { IconName } from '../Icon';

export type BannerAction = { label: string; onPress: () => void };

export type BannerProps = {
  icon?: IconName;
  lead: string;
  message?: string;
  actions?: readonly BannerAction[];
  onDismiss?: () => void;
  testID?: string;
};
