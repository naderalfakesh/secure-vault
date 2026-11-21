import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { biometricStepCopy, useBiometricAvailability } from '@/features/auth/biometricAvailability';
import { useSession } from '@/features/session/SessionProvider';
import { useBlockHardwareBack } from '@/hooks/useBlockHardwareBack';
import { t } from '@/i18n';

import { styles } from './BiometricsStepScreen.styles';
import { BiometricsBadge } from './components';
import { stepBiometry } from './helpers';
import { useBiometricsChoice } from './hooks/useBiometricsChoice';

/**
 * Enable biometrics, after the PIN is saved. "Use Face
 * ID" asks the OS for a biometric check, which on iOS is also where the Face
 * ID permission is asked; only a passed check turns biometric unlock on.
 * Whatever the answer, and after "Not now", the vault opens. Settings shows the reason later if biometrics stay unavailable.
 */
export function BiometricsStepScreen() {
  const { status, setupHeld, biometry } = useSession();
  const availability = useBiometricAvailability();
  const { busy, enableBiometrics, notNow } = useBiometricsChoice();
  const kind = stepBiometry(availability, biometry);
  const copy = biometricStepCopy(kind);

  // Both buttons finish setup; Android's back button is not a third way out.
  useBlockHardwareBack();

  // Only a setup that saved its PIN and is waiting on this step reaches it.
  if (status === 'setup' && !setupHeld) return <Redirect href="/setup" />;

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.body}>
        <BiometricsBadge kind={kind} />
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
