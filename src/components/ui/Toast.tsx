import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ToastTone = 'neutral' | 'success' | 'danger';

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  /** Optional action such as "View" or "Undo". */
  action?: { label: string; onPress: () => void };
  durationMs?: number;
};

type ToastState = ToastOptions & { id: number };

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon: Record<ToastTone, IconName> = {
  neutral: 'info',
  success: 'check',
  danger: 'warning',
};

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
      setToast({ ...options, id: counter.current });
      timer.current = setTimeout(hide, options.durationMs ?? (options.action ? 5000 : 3000));
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
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const tone = toast.tone ?? 'neutral';

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 72 }]}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(220)}
        exiting={reduceMotion ? undefined : FadeOutDown.duration(180)}
        style={styles.toast(tone)}
      >
        <Icon name={toneIcon[tone]} size={18} tone="inverse" />
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          variant="subheadline"
          tone="inverse"
          style={styles.message}
          numberOfLines={2}
        >
          {toast.message}
        </Text>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              onHide();
              toast.action?.onPress();
            }}
          >
            <Text variant="headline" tone="inverse" style={styles.action}>
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
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
    left: theme.spacing.md,
    right: theme.spacing.md,
    alignItems: 'center',
  },
  toast: (tone: ToastTone) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    maxWidth: 480,
    width: '100%',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor:
      tone === 'success'
        ? theme.colors.success
        : tone === 'danger'
          ? theme.colors.danger
          : theme.colors.textPrimary,
    ...theme.shadows.md,
  }),
  message: {
    flex: 1,
  },
  action: {
    textDecorationLine: 'underline',
  },
}));
