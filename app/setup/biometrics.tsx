import * as LocalAuthentication from 'expo-local-authentication';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, Screen, Text } from '@/components/ui';
import { biometricStepCopy, useBiometricAvailability } from '@/features/auth/biometricAvailability';
import { biometryIcon } from '@/features/auth/lockCopy';
import { useSession } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

/**
 * Enable biometrics, after the PIN is saved. "Use Face
 * ID" asks the OS for a biometric check, which on iOS is also where the Face
 * ID permission is asked; only a passed check turns biometric unlock on.
 * Whatever the answer, and after "Not now", the vault opens. Settings shows the reason later if biometrics stay unavailable.
 */
export default function BiometricsStepScreen() {
  const { status, setupHeld, finishSetup, updateSettings, biometry } = useSession();
  const availability = useBiometricAvailability();
  const [busy, setBusy] = useState(false);
  const kind = availability?.kind && availability.kind !== 'none' ? availability.kind : biometry;
  const copy = biometricStepCopy(kind);

  // Both buttons finish setup; Android's back button is not a third way out.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  // Only a setup that saved its PIN and is waiting on this step reaches it.
  if (status === 'setup' && !setupHeld) return <Redirect href="/setup" />;

  const enableBiometrics = async () => {
    setBusy(true);
    let allowed = false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('onboarding.biometrics.prompt'),
        cancelLabel: t('onboarding.biometrics.notNow'),
        disableDeviceFallback: true,
      });
      allowed = result.success;
    } catch {
      // A prompt that could not be shown is a no; the PIN still works.
    }
    // Only a passed check turns it on: the prompt's own "Not now" means no.
    await updateSettings({ biometricUnlock: allowed });
    finishSetup();
  };

  const notNow = async () => {
    setBusy(true);
    await updateSettings({ biometricUnlock: false });
    finishSetup();
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name={kind === 'none' ? 'faceId' : biometryIcon(kind)} size={44} tone="accent" />
        </View>
        <Text variant="title2" align="center" accessibilityRole="header">
          {copy.title}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {copy.body}
        </Text>
      </View>
      <View style={styles.footer}>
        <Button label={copy.action} onPress={enableBiometrics} disabled={busy} />
        <Button
          label={t('onboarding.biometrics.notNow')}
          variant="plain"
          onPress={notNow}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
}));
