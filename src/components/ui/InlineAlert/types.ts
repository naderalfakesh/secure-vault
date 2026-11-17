import type { IconName } from '../Icon';

/** `warning` is the brass callout, e.g. "This can't be stopped." */
export type InlineAlertTone = 'danger' | 'info' | 'success' | 'warning';

export type InlineAlertProps = {
  tone?: InlineAlertTone;
  /** Optional bold lead before the message. */
  title?: string;
  message: string;
  icon?: IconName;
  /**
   * Announce the alert when it appears. Errors always are; turn this on for
   * callouts that appear mid-flow, such as the restore's point of no return.
   */
  announce?: boolean;
  testID?: string;
};
