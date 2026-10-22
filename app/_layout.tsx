import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IconButton, ToastProvider, useToast } from '@/components/ui';
import { SecurityOverlay } from '@/features/session/SecurityOverlay';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { SplashHandoff } from '@/features/session/SplashHandoff';
import { useVaultSweep } from '@/features/session/useVaultSweep';
import { t } from '@/i18n';
import { documentService } from '@/services/DocumentService';
import { loadAppearance } from '@/theme/appearance';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden during a fast refresh; nothing to do.
});

function RootNavigator() {
  const { status, notice, dismissNotice, shareInterrupted } = useSession();
  const { theme } = useUnistyles();
  // Reduced motion: screens cross-fade instead of sliding (§10.3).
  const reduceMotion = useReducedMotion();
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

  // Every decrypted preview, rendered page, and share copy goes when the
  // vault locks, whichever path locked it, and at a launch that does not
  // land on the lock screen.
  useVaultSweep(status);
  useEffect(() => {
    if (status === 'locked') toast.hide();
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

  // The handoff repaints the native splash, then cross-fades out over the
  // lock screen, whose own mark is already in place (§3.5).
  // While it runs, screens appear without a transition: the lock screen must
  // not slide in under the fading splash (§3.5).
  const [handingOff, setHandingOff] = useState(true);
  const endHandoff = useCallback(() => setHandingOff(false), []);
  const handoff = <SplashHandoff released={ready && themed} onDone={endHandoff} />;

  if (!ready) {
    return handoff;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: handingOff ? 'none' : reduceMotion ? 'fade' : 'default',
        }}
      >
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
      {handoff}
    </>
  );
}

const rootStyle = { flex: 1 };

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={rootStyle}>
        {/* Real insets from the first frame, so the lock mark does not move by a
          status bar while the splash fades out over it. */}
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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
