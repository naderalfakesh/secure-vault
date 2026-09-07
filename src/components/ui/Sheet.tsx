import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { IconButton } from './IconButton';
import { Text } from './Text';

export type SheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Hide the close button, e.g. while work is in progress. */
  dismissable?: boolean;
  testID?: string;
}>;

const OPEN_MS = 260;
const CLOSE_MS = 200;

/**
 * Bottom sheet for choices, confirmations, and progress. Replaces the
 * prototype's Alert.alert calls for everything that is not destructive.
 */
export function Sheet({
  visible,
  onClose,
  title,
  dismissable = true,
  children,
  testID,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    const target = visible ? 1 : 0;
    progress.value = reduceMotion
      ? target
      : withTiming(target, {
          duration: visible ? OPEN_MS : CLOSE_MS,
          easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        });
  }, [progress, reduceMotion, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 40 }],
    opacity: progress.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissable ? onClose : undefined}
      testID={testID}
    >
      <View style={[styles.root, { paddingBottom: keyboardHeight }]}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.backdropPressable}
            onPress={dismissable ? onClose : undefined}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) }, panelStyle]}
        >
          <View style={styles.grabber} />
          {title || dismissable ? (
            <View style={styles.header}>
              <View style={styles.headerTitle}>
                {title ? (
                  <Text variant="title3" accessibilityRole="header">
                    {title}
                  </Text>
                ) : null}
              </View>
              {dismissable ? (
                <IconButton
                  icon="close"
                  accessibilityLabel="Close"
                  variant="tinted"
                  size={18}
                  onPress={onClose}
                />
              ) : null}
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Height of the software keyboard. A modal's window does not resize for the
 * keyboard on Android, so the sheet lifts itself above it instead.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
  backdropPressable: {
    flex: 1,
  },
  panel: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    gap: theme.spacing.sm,
    ...theme.shadows.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.borderStrong,
    marginBottom: theme.spacing.xxs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.touchTarget,
  },
  headerTitle: {
    flex: 1,
  },
}));
