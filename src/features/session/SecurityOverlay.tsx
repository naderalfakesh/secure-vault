import { BlurView } from 'expo-blur';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Platform,
  StyleSheet as NativeStyleSheet,
  View,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, Text } from '@/components/ui';

import { useSession } from './SessionProvider';

/**
 * Privacy screen: blurs the app while it is inactive (app switcher, incoming
 * call) and blocks screenshots and screen recording while unlocked. Both
 * follow the "privacy screen" setting; the lock screen itself needs neither.
 */
export function SecurityOverlay() {
  const { status, settings } = useSession();
  const enabled = settings.privacyScreen && status === 'unlocked';
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [enabled]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => setObscured(next !== 'active');
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);

  if (!enabled || !obscured) return null;

  return (
    <BlurView intensity={80} tint="dark" style={NativeStyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.inner} accessibilityElementsHidden>
        <Icon name="lock" size={36} color="#FFFFFF" />
        <Text variant="headline" style={styles.label}>
          SecureVault
        </Text>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create((theme) => ({
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: 'rgba(11, 15, 30, 0.55)',
  },
  label: {
    color: '#FFFFFF',
  },
}));
