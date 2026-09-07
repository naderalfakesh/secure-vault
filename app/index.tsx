import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, Screen, Text } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { useSecurityStatus } from '@/hooks/useSecurityStatus';

export default function LockScreen() {
  const { status, unlock, setUp, error } = useSession();
  const security = useSecurityStatus();
  const [busy, setBusy] = useState(false);
  const promptedRef = useRef(false);
  const isSetup = status === 'setup';

  // Returning users get the biometric prompt as soon as the screen appears.
  useEffect(() => {
    if (status !== 'locked' || promptedRef.current) return;
    promptedRef.current = true;
    setBusy(true);
    unlock().finally(() => setBusy(false));
  }, [status, unlock]);

  const handlePress = async () => {
    setBusy(true);
    try {
      await (isSetup ? setUp() : unlock());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} padded>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Icon name={isSetup ? 'shield' : 'lock'} size={40} tone="accent" />
        </View>
        <Text variant="largeTitle" align="center" accessibilityRole="header">
          SecureVault
        </Text>
        <Text variant="body" tone="secondary" align="center" style={styles.lede}>
          {isSetup
            ? 'Your IDs, cards, and papers, encrypted with a key that never leaves this device.'
            : 'Your documents stay encrypted until you unlock.'}
        </Text>
      </View>

      <View style={styles.footer}>
        {security.isSecure ? null : (
          <View style={styles.banner} accessibilityRole="alert">
            <Icon name="warning" size={18} tone="warning" />
            <Text variant="footnote" tone="secondary" style={styles.bannerText}>
              This device looks rooted or modified. Your vault still works, but be careful.
            </Text>
          </View>
        )}
        {error ? (
          <Text variant="footnote" tone="danger" align="center" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label={isSetup ? 'Set up SecureVault' : 'Unlock'}
          onPress={handlePress}
          loading={busy}
          leading={<Icon name={isSetup ? 'check' : 'unlock'} size={18} tone="inverse" />}
        />
        <Text variant="caption" tone="tertiary" align="center">
          {isSetup
            ? 'Unlock uses Face ID, Touch ID, or your device passcode.'
            : 'Nothing is uploaded. Nothing is shared.'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.sm,
  },
  lede: {
    maxWidth: 320,
  },
  footer: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.warningMuted,
  },
  bannerText: {
    flex: 1,
  },
}));
