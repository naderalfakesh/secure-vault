import type { IconName } from '../Icon';

export type TabBarItem = {
  key: string;
  label: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
};

export type TabBarProps = {
  /** The tab before the Scan button (Library) and the tabs after it (Settings). */
  tabs: readonly [TabBarItem, ...TabBarItem[]];
  onScan: () => void;
  scanLabel?: string;
};

export type TabProps = { item: TabBarItem };
