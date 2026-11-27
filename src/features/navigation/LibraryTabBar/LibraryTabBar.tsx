import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { TabBar } from '@/components/ui';
import { t } from '@/i18n';

import { useTabBarHidden } from '../tabBarVisibility';
import { TABS } from './constants';

export type LibraryTabBarProps = BottomTabBarProps;

export function LibraryTabBar({ state, emitter, navigateToTab }: LibraryTabBarProps) {
  const hidden = useTabBarHidden();
  if (hidden) return null;

  const items = state.routes.flatMap((route) => {
    const tab = TABS[route.name];
    if (!tab) return [];
    const selected = state.routes[state.index]?.key === route.key;
    return {
      key: route.key,
      label: t(tab.label),
      icon: tab.icon,
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

  return (
    <TabBar tabs={items} onScan={() => router.push('/documents/add')} scanLabel={t('nav.scan')} />
  );
}
