import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';

import { GlassBackground, useGlass } from '../Glass';
import { Icon } from '../Icon';
import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from './constants';
import { Tab } from './Tab';
import type { TabBarProps } from './types';
import { styles } from './TabBar.styles';

/**
 * Floating tab bar: Library · central Scan button · Settings.
 * On iOS 26+ the capsule is Liquid Glass; on Android, older iOS, and
 * with Reduce Transparency on it is the solid surface with a hairline.
 */
export function TabBar({ tabs, onScan, scanLabel = t('ui.tabBar.scan') }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const glass = useGlass();
  // A capsule at any height: larger text makes the bar taller.
  const [height, setHeight] = useState(TAB_BAR_HEIGHT);
  const [first, ...rest] = tabs;

  return (
    <View
      accessibilityRole="tablist"
      // 26 pt above the edge on a home-indicator iPhone; clear of any system bar elsewhere.
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={[
        styles.bar,
        glass && styles.glassBar,
        {
          bottom:
            insets.bottom > 0 ? Math.max(TAB_BAR_BOTTOM, insets.bottom - 8) : TAB_BAR_BOTTOM / 2,
        },
      ]}
    >
      {glass ? <GlassBackground style={{ borderRadius: height / 2 }} /> : null}
      <Tab item={first} />
      <Pressable
        // An action, but it sits in the tab list, so it is a tab that is never selected.
        accessibilityRole="tab"
        accessibilityLabel={scanLabel}
        accessibilityHint={t('ui.tabBar.scanHint')}
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
