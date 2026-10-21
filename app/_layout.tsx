import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IconButton, ToastProvider, useToast } from '@/components/ui';
import { SecurityOverlay } from '@/features/session/SecurityOverlay';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { backupService } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden during a fast refresh; nothing to do.
});

function RootNavigator() {
  const { status, notice, dismissNotice } = useSession();
  const { theme } = useUnistyles();
  const toast = useToast();
  const ready = status !== 'loading';
  const unlocked = status === 'unlocked';

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  useEffect(() => {
    documentService.sweepLegacyScratch();
  }, []);

  useEffect(() => {
    // Every decrypted preview, rendered page, and share copy goes when the
    // vault locks, whichever path locked it.
    if (status === 'locked') {
      toast.hide();
      documentService.clearCache().catch(() => {});
      // Backup ciphertext too: finished containers and the picker's copies.
      backupService.sweepCache();
    }
  }, [status, toast]);

  useEffect(() => {
    // Work that ended behind the lock reports here, never over the lock screen.
    if (status === 'unlocked' && notice) {
      toast.show(notice);
      dismissNotice();
    }
  }, [status, notice, toast, dismissNotice]);

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
      {/* The lock screen needs a URL of its own. At `/` it shared the address of
          (tabs)/index, so the guard's redirect to it resolved back to the guarded
          tabs and expo-router 58 redirected forever. */}
      <Stack.Protected guard={status === 'locked'}>
        <Stack.Screen name="lock" />
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
