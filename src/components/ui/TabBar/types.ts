import type { IconName } from '../Icon';

export type TabBarItem = {
  key: string;
  label: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
};

export type TabBarProps = {
  tabs: readonly TabBarItem[];
  onScan: () => void;
  scanLabel?: string;
};

export type TabProps = { item: TabBarItem };
