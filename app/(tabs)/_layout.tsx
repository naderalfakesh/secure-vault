import { router, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';

import { type IconName, TabBar } from '@/components/ui';
import { useTabBarHidden } from '@/features/navigation/tabBarVisibility';

const tabs: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Library', icon: 'library' },
  settings: { label: 'Settings', icon: 'settings' },
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
        label: tabs[route.name].label,
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
      scanLabel="Scan or import a document"
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <LibraryTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Library' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
