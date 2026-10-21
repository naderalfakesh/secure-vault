import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { darkColors } from '@/theme/colors';
import { motion } from '@/theme/tokens';

import { useAnnouncement } from './announce';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ToastTone = 'neutral' | 'success' | 'danger';

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  /** Optional action such as "View" or "Undo". */
  action?: { label: string; onPress: () => void };
  /** Leading icon; defaults to one per tone. */
  icon?: IconName;
  /** Show a countdown ring next to the action, e.g. for Undo. */
  countdown?: boolean;
  /** Defaults to 4 s, or 8 s with an action. */
  durationMs?: number;
};

type ToastState = ToastOptions & { id: number; durationMs: number };

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon: Record<ToastTone, IconName> = {
  neutral: 'info',
  success: 'checkCircle',
  danger: 'warning',
};

/** Space kept clear below a toast: the tab bar plus 16 pt. */
const TAB_BAR_CLEARANCE = 72;

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      counter.current += 1;
      const durationMs =
        options.durationMs ?? (options.action ? motion.toastWithActionMs : motion.toastMs);
      setToast({ ...options, durationMs, id: counter.current });
      timer.current = setTimeout(hide, durationMs);
    },
    [hide],
  );

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onHide={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onHide }: { toast: ToastState; onHide: () => void }) {
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
        entering={reduceMotion ? FadeIn.duration(160) : FadeInDown.duration(220)}
        exiting={reduceMotion ? FadeOut.duration(120) : FadeOutDown.duration(180)}
        style={styles.toast(danger)}
      >
        <Icon name={toast.icon ?? toneIcon[tone]} size={20} color={iconColor} />
        <Text
          accessibilityRole={danger ? 'alert' : undefined}
          accessibilityLiveRegion={danger ? 'assertive' : 'polite'}
          variant="subheadline"
          style={[styles.message, { color: ink }]}
          numberOfLines={3}
        >
          {toast.message}
        </Text>
        {toast.action ? (
          <View style={styles.trailing}>
            {toast.countdown ? (
              <Countdown seconds={Math.round(toast.durationMs / 1000)} still={reduceMotion} />
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

/**
 * Seconds left for an undo. The ring is static; only the number changes, and
 * with reduced motion it does not tick at all.
 */
function Countdown({ seconds, still }: { seconds: number; still: boolean }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (still) return;
    const interval = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(interval);
  }, [still]);

  return (
    <View
      style={styles.ring}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="toast-countdown"
    >
      <Text variant="caption" style={styles.ringLabel}>
        {still ? `${seconds}s` : left}
      </Text>
    </View>
  );
}

/** Show short confirmations without interrupting the user. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create((theme) => ({
  host: {
    position: 'absolute',
    start: theme.spacing.md,
    end: theme.spacing.md,
    alignItems: 'center',
  },
  toast: (danger: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    width: '100%',
    minHeight: 52,
    paddingVertical: theme.spacing.xs,
    paddingStart: theme.spacing.md,
    paddingEnd: theme.spacing.xs,
    borderRadius: theme.radii.toast,
    backgroundColor: danger ? theme.colors.toastDangerBg : theme.colors.toastBg,
    ...theme.elevation.sheet,
  }),
  message: {
    flex: 1,
    paddingVertical: theme.spacing.xxs,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  action: {
    minHeight: theme.touchTarget,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    justifyContent: 'center',
  },
  actionLabel: {
    color: theme.colors.toastAction,
    fontWeight: '600',
  },
  ring: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.pill,
    borderWidth: 2,
    borderColor: theme.colors.toastAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    color: theme.colors.toastText,
    fontVariant: ['tabular-nums'],
  },
}));
