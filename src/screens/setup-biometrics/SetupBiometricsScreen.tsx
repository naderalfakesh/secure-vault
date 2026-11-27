import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { biometricStepCopy, useBiometricAvailability } from '@/features/auth/biometricAvailability';
import { useSessionState } from '@/features/session/SessionProvider';
import { useBlockHardwareBack } from '@/hooks/useBlockHardwareBack';
import { t } from '@/i18n';

import { BiometricsBadge } from './components';
import { stepBiometry } from './helpers';
import { useBiometricsChoice } from './hooks/useBiometricsChoice';
import { styles } from './SetupBiometricsScreen.styles';

// Triggering biometrics here also prompts iOS Face ID permission; only a passed check enables biometric unlock.
export function SetupBiometricsScreen() {
  const { status, setupHeld, biometry } = useSessionState();
  const availability = useBiometricAvailability();
  const { busy, enableBiometrics, notNow } = useBiometricsChoice();
  const kind = stepBiometry(availability, biometry);
  const copy = biometricStepCopy(kind);

  // Block Android back so setup only exits through the two explicit actions.
  useBlockHardwareBack();

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
