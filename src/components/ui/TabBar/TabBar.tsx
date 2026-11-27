import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';

import { GlassBackground, useGlass } from '../Glass';
import { Icon } from '../Icon';
import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from './constants';
import { Tab } from './Tab';
import { styles } from './TabBar.styles';
import type { TabBarProps } from './types';

export function TabBar({ tabs, onScan, scanLabel = t('ui.tabBar.scan') }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const glass = useGlass();
  const [height, setHeight] = useState(TAB_BAR_HEIGHT);
  const [first, ...rest] = tabs;
  if (!first) return null;

  return (
    <View
      accessibilityRole="tablist"
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
        // Scan sits inside the tablist container, so it uses role="tab" (never selected).
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
