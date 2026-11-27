import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUnistyles } from 'react-native-unistyles';

import { AppProviders } from '@/features/navigation/AppProviders';
import { HeaderBackButton } from '@/features/navigation/HeaderBackButton';
import { useRootGate } from '@/features/navigation/hooks/useRootGate';
import { holdNativeSplash } from '@/features/navigation/launchSplash';
import { useStatusBarStyle } from '@/features/navigation/statusBarStyle';
import { SecurityOverlay } from '@/features/session/SecurityOverlay';
import { SplashHandoff } from '@/features/session/SplashHandoff';

holdNativeSplash();

function RootNavigator() {
  const { status, ready, released, endHandoff, animation } = useRootGate();
  const { theme } = useUnistyles();
  const statusBarStyle = useStatusBarStyle();
  const unlocked = status === 'unlocked';
  const header = {
    headerShown: true,
    headerLeft: () => <HeaderBackButton />,
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.primary,
    headerShadowVisible: false,
  };

  // Keyed in the same fragment position across both branches so SplashHandoff never remounts
  // and re-reads the pinned scheme right before fading.
  const handoff = <SplashHandoff key="splash-handoff" released={released} onDone={endHandoff} />;

  if (!ready) {
    return <>{handoff}</>;
  }

  return (
    <>
      {/* iOS reads statusBarStyle from the screen's VC; root <StatusBar> only affects Android. */}
      <Stack screenOptions={{ headerShown: false, animation, statusBarStyle }}>
        <Stack.Protected guard={unlocked}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="documents/[id]" options={{ ...header, title: '' }} />
          <Stack.Screen name="documents/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings/auto-lock" />
          <Stack.Screen name="settings/protection" />
          <Stack.Screen name="settings/backup" />
          <Stack.Screen name="settings/change-pin" options={header} />
        </Stack.Protected>
        {/* Dedicated route required: sharing `/` with guarded (tabs)/index causes an expo-router redirect loop. */}
        <Stack.Protected guard={status === 'locked'}>
          <Stack.Screen name="lock" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'setup'}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'unavailable'}>
          <Stack.Screen name="unavailable" options={{ gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>
      {handoff}
    </>
  );
}

export default function RootLayout() {
  const statusBarStyle = useStatusBarStyle();
  return (
    <AppProviders>
      <StatusBar style={statusBarStyle} />
      <RootNavigator />
      <SecurityOverlay />
    </AppProviders>
  );
}
