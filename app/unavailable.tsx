import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, Screen, Text } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { useSession } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

/**
 * The device key or the PIN record could not be read (handover §7.2). The
 * way on is to read them again: no erase, restore or settings, and nothing is
 * written. The session also tries again on its own each time the app returns
 * to the foreground. When the PIN record is gone although it was written and
 * the device key is there, the device key's own gate also opens setup, to add
 * a new PIN to the vault as it is.
 */
export default function VaultUnavailableScreen() {
  const { retry, pinLost, resetLostPin, error } = useSession();
  const [trying, setTrying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useAnnouncement(
    trying ? t('unavailable.trying') : resetting ? t('unavailable.pinLost.resetting') : null,
  );

  const tryAgain = () => {
    setTrying(true);
    retry()
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setTrying(false);
      });
  };

  const resetPin = () => {
    setResetting(true);
    resetLostPin()
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setResetting(false);
      });
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tile}>
          <Icon name="lock" size={32} tone="secondary" />
        </View>
        <Text variant="title2" align="center" accessibilityRole="header">
          {t('unavailable.title')}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {pinLost ? t('unavailable.pinLost.body') : t('unavailable.body')}
        </Text>
        <Text variant="subheadline" tone="tertiary" align="center">
          {pinLost ? t('unavailable.pinLost.hint') : t('unavailable.hint')}
        </Text>
        {pinLost && error ? (
          <Text variant="subheadline" tone="danger" align="center">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.footer} accessibilityLiveRegion="polite">
        {pinLost ? (
          <Button
            label={t('unavailable.pinLost.reset')}
            icon="lock"
            loading={resetting}
            loadingLabel={t('unavailable.pinLost.resetting')}
            disabled={trying}
            onPress={resetPin}
          />
        ) : null}
        <Button
          variant={pinLost ? 'secondary' : 'primary'}
          label={t('unavailable.tryAgain')}
          icon="refresh"
          loading={trying}
          loadingLabel={t('unavailable.trying')}
          disabled={resetting}
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
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
}));
