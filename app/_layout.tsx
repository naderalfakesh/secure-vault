import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUnistyles } from 'react-native-unistyles';

import { AppProviders } from '@/features/navigation/AppProviders';
import { HeaderBackButton } from '@/features/navigation/HeaderBackButton';
import { holdNativeSplash } from '@/features/navigation/launchSplash';
import { useRootGate } from '@/features/navigation/useRootGate';
import { SecurityOverlay } from '@/features/session/SecurityOverlay';
import { SplashHandoff } from '@/features/session/SplashHandoff';

holdNativeSplash();

function RootNavigator() {
  const { status, ready, released, endHandoff, animation } = useRootGate();
  const { theme } = useUnistyles();
  const unlocked = status === 'unlocked';
  const header = {
    headerShown: true,
    headerLeft: () => <HeaderBackButton />,
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.primary,
    headerShadowVisible: false,
  };

  // Keyed, and a child of the same fragment in both returns, so the overlay
  // is the same instance before and after the session is ready. Remounted, it
  // read the scheme again after the pinned Appearance had been applied and
  // flipped from the system colours to the pinned ones just before its fade.
  const handoff = <SplashHandoff key="splash-handoff" released={released} onDone={endHandoff} />;

  if (!ready) {
    return <>{handoff}</>;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation }}>
        {/* Every document route lives behind the lock gate; there is no way to deep link past it. */}
        <Stack.Protected guard={unlocked}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="documents/[id]" options={{ ...header, title: '' }} />
          <Stack.Screen name="documents/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings/auto-lock" />
          <Stack.Screen name="settings/protection" />
          <Stack.Screen name="settings/backup" />
          <Stack.Screen name="settings/change-pin" options={header} />
        </Stack.Protected>
        {/* The lock screen needs a URL of its own. At `/` it shared the address of
          (tabs)/index, so the guard's redirect to it resolved back to the guarded
          tabs and expo-router 58 redirected forever. */}
        <Stack.Protected guard={status === 'locked'}>
          <Stack.Screen name="lock" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'setup'}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        {/* The key or the PIN record could not be read. Its own group and URL,
          so no other screen, setup included, resolves while it is up. */}
        <Stack.Protected guard={status === 'unavailable'}>
          <Stack.Screen name="unavailable" options={{ gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>
      {handoff}
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <RootNavigator />
      <SecurityOverlay />
    </AppProviders>
  );
}
