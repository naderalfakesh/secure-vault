import type { IconName } from '../Icon';

export type FileCardProps = {
  /** File name; isolated so mixed-direction names stay readable. */
  name: string;
  /** e.g. "48 entries · made 3 Oct 2026". */
  meta?: string;
  icon?: IconName;
  testID?: string;
};
