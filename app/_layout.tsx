import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IconButton, ToastProvider, useToast } from '@/components/ui';
import { SecurityOverlay } from '@/features/session/SecurityOverlay';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { t } from '@/i18n';
import { backupService } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';
import { loadAppearance } from '@/theme/appearance';

import vault from '../modules/expo-vault';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden during a fast refresh; nothing to do.
});

function RootNavigator() {
  const { status, notice, dismissNotice, shareInterrupted } = useSession();
  const { theme } = useUnistyles();
  const toast = useToast();
  const ready = status !== 'loading';
  const unlocked = status === 'unlocked';

  // The stored Appearance setting overrides the system theme, lock screen
  // included. It is read alongside the session, and the splash stays until
  // both are in, so the first frame is already in the chosen theme.
  const [themed, setThemed] = useState(false);

  useEffect(() => {
    if (ready && themed) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, themed]);

  useEffect(() => {
    documentService.sweepLegacyScratch();
    loadAppearance()
      .catch(() => {})
      .finally(() => setThemed(true));
  }, []);

  useEffect(() => {
    // Every decrypted preview, rendered page, and share copy goes when the
    // vault locks, whichever path locked it.
    if (status === 'locked') {
      toast.hide();
      // F7: a share sheet left up (iOS) closes with the vault, before its copy
      // goes, so it never sits over the lock screen offering a deleted file.
      vault.dismissShareSheet().catch(() => false);
      documentService.clearCache().catch(() => {});
      // Backup ciphertext too: finished containers and the picker's copies.
      backupService.sweepCache();
    }
  }, [status, toast]);

  // A lock that cut a share short brings the user back to that document's
  // viewer after the unlock, where its banner explains (handover §6 J5, F7).
  // Only on the unlock that follows a lock, once per lock.
  const backToShare = useRef(false);
  useEffect(() => {
    if (status === 'locked') backToShare.current = true;
    else if (status !== 'unlocked') backToShare.current = false;
  }, [status]);
  useEffect(() => {
    if (status !== 'unlocked' || !backToShare.current) return;
    backToShare.current = false;
    if (!shareInterrupted) return;
    const { documentId } = shareInterrupted;
    // The guarded screens are back only once this render has been committed.
    const timer = setTimeout(() => {
      router.push({ pathname: '/documents/[id]', params: { id: documentId } });
    }, 0);
    return () => clearTimeout(timer);
  }, [status, shareInterrupted]);

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
              <IconButton
                icon="back"
                accessibilityLabel={t('common.back')}
                onPress={() => router.back()}
              />
            ),
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.primary,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="documents/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings/auto-lock" />
        <Stack.Screen name="settings/protection" />
        <Stack.Screen name="settings/backup" />
        <Stack.Screen
          name="settings/change-pin"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.primary,
            headerShadowVisible: false,
            headerLeft: () => (
              <IconButton
                icon="back"
                accessibilityLabel={t('common.back')}
                onPress={() => router.back()}
              />
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
      {/* The key or the PIN record could not be read. Its own group and URL,
          so no other screen, setup included, resolves while it is up. */}
      <Stack.Protected guard={status === 'unavailable'}>
        <Stack.Screen name="unavailable" options={{ gestureEnabled: false }} />
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
