import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/features/session/SessionProvider';

const rootStyle = { flex: 1 };

type AppProvidersProps = {
  children: ReactNode;
};

/** The app-wide providers around the root navigator. */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={rootStyle}>
        {/* Real insets from the first frame, so the lock mark does not move by a
          status bar while the splash fades out over it. */}
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
