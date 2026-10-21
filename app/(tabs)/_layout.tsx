import { router, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';

import { type IconName, TabBar } from '@/components/ui';
import { useTabBarHidden } from '@/features/navigation/tabBarVisibility';
import { type StringKey, t } from '@/i18n';

const tabs: Record<string, { label: StringKey; icon: IconName }> = {
  index: { label: 'nav.library', icon: 'library' },
  settings: { label: 'nav.settings', icon: 'settings' },
};

/** Library · central Scan button · Settings (handover §4, §11.1). */
function LibraryTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const hidden = useTabBarHidden();
  if (hidden) return null;

  const items = state.routes
    .filter((route) => tabs[route.name])
    .map((route) => {
      const selected = state.routes[state.index]?.key === route.key;
      return {
        key: route.key,
        label: t(tabs[route.name].label),
        icon: tabs[route.name].icon,
        selected,
        onPress: () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!selected && !event.defaultPrevented) navigateToTab(route.key);
        },
      };
    });
  const [first, ...rest] = items;
  if (!first) return null;

  return (
    <TabBar
      tabs={[first, ...rest]}
      onScan={() => router.push('/documents/add')}
      scanLabel={t('nav.scan')}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <LibraryTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('nav.library') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.settings') }} />
    </Tabs>
  );
}
