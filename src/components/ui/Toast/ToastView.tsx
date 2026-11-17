import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { darkColors } from '@/theme/colors';

import { useAnnouncement } from '../announce';
import { Icon } from '../Icon';
import { Text } from '../Text';
import {
  ENTER_MS,
  EXIT_MS,
  FADE_IN_MS,
  FADE_OUT_MS,
  TAB_BAR_CLEARANCE,
  toneIcon,
} from './constants';
import { Countdown } from './Countdown';
import { styles } from './ToastView.styles';
import type { ToastViewProps } from './types';

export function ToastView({ toast, onHide }: ToastViewProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const tone = toast.tone ?? 'neutral';
  const danger = tone === 'danger';
  const ink = danger ? theme.colors.toastDangerText : theme.colors.toastText;
  // Toasts are dark in both themes, so the success glyph uses the dark-mode green.
  const iconColor = danger
    ? theme.colors.toastDangerIcon
    : tone === 'success'
      ? darkColors.success
      : ink;
  useAnnouncement(toast.message);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
    >
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(FADE_IN_MS) : FadeInDown.duration(ENTER_MS)}
        exiting={reduceMotion ? FadeOut.duration(FADE_OUT_MS) : FadeOutDown.duration(EXIT_MS)}
        style={styles.toast(danger)}
      >
        <Icon name={toast.icon ?? toneIcon[tone]} size={20} color={iconColor} />
        <Text
          accessibilityRole={danger ? 'alert' : undefined}
          accessibilityLiveRegion={danger ? 'assertive' : 'polite'}
          variant="subheadline"
          style={[styles.message, { color: ink }]}
        >
          {toast.message}
        </Text>
        {toast.action ? (
          <View style={styles.trailing}>
            {toast.countdown ? (
              <Countdown durationMs={toast.durationMs} still={reduceMotion} />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              hitSlop={4}
              onPress={() => {
                onHide();
                toast.action?.onPress();
              }}
              style={styles.action}
            >
              <Text variant="subheadline" style={styles.actionLabel}>
                {toast.action.label}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
