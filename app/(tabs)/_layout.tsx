import { Tabs } from 'expo-router';

import { LibraryTabBar } from '@/features/navigation/LibraryTabBar';
import { t } from '@/i18n';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <LibraryTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('nav.library') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.settings') }} />
    </Tabs>
  );
}
