import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IconButton, ToastProvider } from '@/components/ui';
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
      </Stack.Protected>
      <Stack.Protected guard={!unlocked}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SessionProvider>
          <ToastProvider>
            <StatusBar style="auto" />
            <RootNavigator />
          </ToastProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
