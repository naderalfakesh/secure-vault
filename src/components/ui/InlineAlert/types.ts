import type { IconName } from '../Icon';

export type InlineAlertTone = 'danger' | 'info' | 'success' | 'warning';

export type InlineAlertProps = {
  tone?: InlineAlertTone;
  title?: string;
  message: string;
  icon?: IconName;
  announce?: boolean;
  testID?: string;
};
