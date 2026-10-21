import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, Screen, Text } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { useSession } from '@/features/session/SessionProvider';

const UNAVAILABLE_TITLE = 'SecureVault can’t open right now';
const BODY =
  'Your phone didn’t give SecureVault access to its key. Nothing in the vault was touched.';
const HINT = 'Try again. If this keeps happening, restart your phone and open SecureVault again.';
const TRYING = 'Trying again…';

/**
 * The device key or the PIN record could not be read (handover §7.2). The
 * only way on is to read them again: no setup, erase, restore or settings,
 * and nothing is written. The session also tries again on its own each time
 * the app returns to the foreground.
 */
export default function VaultUnavailableScreen() {
  const { retry } = useSession();
  const [trying, setTrying] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useAnnouncement(trying ? TRYING : null);

  const tryAgain = () => {
    setTrying(true);
    retry()
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setTrying(false);
      });
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tile}>
          <Icon name="lock" size={32} tone="secondary" />
        </View>
        <Text variant="title2" align="center" accessibilityRole="header">
          {UNAVAILABLE_TITLE}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {BODY}
        </Text>
        <Text variant="subheadline" tone="tertiary" align="center">
          {HINT}
        </Text>
      </ScrollView>
      <View style={styles.footer} accessibilityLiveRegion="polite">
        <Button
          label="Try again"
          icon="refresh"
          loading={trying}
          loadingLabel={TRYING}
          onPress={tryAgain}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  tile: {
    width: 80,
    height: 80,
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    marginBottom: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
}));
