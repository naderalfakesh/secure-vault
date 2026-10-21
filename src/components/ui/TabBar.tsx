import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

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

/** Height of the floating capsule and its gap to the bottom edge. */
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_BOTTOM = 26;

/**
 * Floating tab bar (handover §4): Library · central Scan button · Settings.
 * Liquid Glass (GlassView, iOS 26) needs the expo-glass-effect native module,
 * which is not installed yet, so every platform uses the solid surface with a
 * hairline, the handover's fallback.
 */
export function TabBar({ tabs, onScan, scanLabel = 'Scan a document' }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [first, ...rest] = tabs;

  return (
    <View
      accessibilityRole="tablist"
      // 26 pt above the edge on a home-indicator iPhone; clear of any system bar elsewhere.
      style={[
        styles.bar,
        {
          bottom:
            insets.bottom > 0 ? Math.max(TAB_BAR_BOTTOM, insets.bottom - 8) : TAB_BAR_BOTTOM / 2,
        },
      ]}
    >
      <Tab item={first} />
      <Pressable
        // An action, but it sits in the tab list, so it is a tab that is never selected.
        accessibilityRole="tab"
        accessibilityLabel={scanLabel}
        accessibilityHint="Opens the scanner"
        accessibilityState={{ selected: false }}
        onPress={onScan}
        style={({ pressed }) => [styles.scan, pressed && styles.pressed]}
      >
        <Icon name="scan" size={26} tone="inverse" />
      </Pressable>
      {rest.map((item) => (
        <Tab key={item.key} item={item} />
      ))}
    </View>
  );
}

function Tab({ item }: { item: TabBarItem }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.selected }}
      onPress={item.onPress}
      style={styles.tab(item.selected)}
    >
      <Icon name={item.icon} size={22} tone={item.selected ? 'accent' : 'secondary'} />
      <Text variant="caption" tone={item.selected ? 'accent' : 'secondary'} style={styles.label}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    position: 'absolute',
    start: theme.spacing.lg,
    end: theme.spacing.lg,
    height: TAB_BAR_HEIGHT,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.elevation.floating,
  },
  tab: (selected: boolean) => ({
    width: 104,
    height: 56,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
  }),
  label: {
    fontWeight: '600',
  },
  scan: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...theme.elevation.floating,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
