import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IconButton, ToastProvider } from '@/components/ui';
import { SecurityOverlay } from '@/features/session/SecurityOverlay';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden during a fast refresh; nothing to do.
});

function RootNavigator() {
  const { status } = useSession();
  const { theme } = useUnistyles();
  const ready = status !== 'loading';
  const unlocked = status === 'unlocked';

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Every document route lives behind the lock gate; there is no way to deep link past it. */}
      <Stack.Protected guard={unlocked}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="documents/[id]"
          options={{
            headerShown: true,
            title: '',
            // One explicit back control so the header reads the same on iOS and Android.
            headerLeft: () => (
              <IconButton icon="back" accessibilityLabel="Back" onPress={() => router.back()} />
            ),
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.primary,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="documents/add" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="settings/change-pin"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.primary,
            headerShadowVisible: false,
            headerLeft: () => (
              <IconButton icon="back" accessibilityLabel="Back" onPress={() => router.back()} />
            ),
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={status === 'locked'}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'setup'}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
    </Stack>
  );
}

const rootStyle = { flex: 1 };

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={rootStyle}>
        <SafeAreaProvider>
          <SessionProvider>
            <ToastProvider>
              <StatusBar style="auto" />
              <RootNavigator />
              <SecurityOverlay />
            </ToastProvider>
          </SessionProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
