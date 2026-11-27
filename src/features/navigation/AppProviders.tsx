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

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={rootStyle}>
        {/* Seed real insets on frame 1 so the lock mark doesn't shift under the splash. */}
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
