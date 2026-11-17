import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { PinDots, PinPad, Screen, Text, usePinPadMetrics } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { LOCKOUT_BODY } from '@/features/auth/lockCopy';
import { useSession } from '@/features/session/SessionProvider';

import { styles } from './ChangePinScreen.styles';
import { PinMessage, StepBar } from './components';
import { pinPrompt } from './helpers';
import { useChangePinFlow } from './hooks/useChangePinFlow';
import { useLockoutCountdown } from './hooks/useLockoutCountdown';

export function ChangePinScreen() {
  const { changePin, error, lockout } = useSession();
  const { compact } = usePinPadMetrics();
  const lockLeft = useLockoutCountdown(lockout);
  const { stage, message, entry } = useChangePinFlow(changePin);
  const { pin, error: flash, shake, press } = entry;

  const { lockedOut, alert, title, subtitle } = pinPrompt(stage, lockLeft, message, error);
  // iOS ignores live regions: speak errors, and the lockout once when it begins.
  useAnnouncement(lockedOut ? LOCKOUT_BODY : alert ? subtitle : null);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StepBar stage={stage} />
      {/* On a short window or at large text the prompt scrolls above the keypad. */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body(compact)}
        bounces={false}
        showsVerticalScrollIndicator={false}
        testID="pin-header"
      >
        <Text variant="title2" align="center" accessibilityRole="header">
          {title}
        </Text>
        <PinMessage subtitle={subtitle} alert={alert} />
        <View
          style={[styles.dots(compact), lockedOut && styles.dimmed]}
          accessibilityElementsHidden={lockedOut}
          importantForAccessibility={lockedOut ? 'no-hide-descendants' : 'auto'}
        >
          <PinDots filled={pin.length} error={flash} shake={shake} />
        </View>
      </ScrollView>
      <View style={styles.pad(compact)}>
        <PinPad onKey={press} disabled={lockedOut} busy={stage === 'saving'} />
      </View>
    </Screen>
  );
}
