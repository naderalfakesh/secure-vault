import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from './Icon';
import { Text } from './Text';

export type SheetDetent = 'auto' | 'medium' | 'large';

export type SheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Leading text button in the header, e.g. "Cancel" or "Reset". */
  headerAction?: { label: string; onPress: () => void };
  /**
   * False while work is in progress: no close button, and neither the
   * backdrop nor the back gesture closes the sheet.
   */
  dismissable?: boolean;
  /** `auto` fits the content; `medium` and `large` fix the height. */
  detent?: SheetDetent;
  testID?: string;
}>;

const CLOSE_MS = 200;
const SLIDE = 40;

/**
 * Bottom sheet for choices, confirmations, and progress (handover §4). On iOS
 * it floats 8 pt in from the edges; on Android it is attached to the bottom.
 * Liquid Glass (iOS 26) is not wired yet; the sheet uses the solid elevated
 * surface, which is also its fallback.
 */
export function Sheet({
  visible,
  onClose,
  title,
  headerAction,
  dismissable = true,
  detent = 'auto',
  children,
  testID,
}: SheetProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduceMotion) {
      // Reduced motion: a cross-fade instead of the slide.
      progress.value = withTiming(target, { duration: theme.motion.durationBase });
      return;
    }
    progress.value = visible
      ? withSpring(target, theme.motion.spring)
      : withTiming(target, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) });
  }, [progress, reduceMotion, visible, theme.motion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.min(progress.value, 1) }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1),
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * SLIDE }],
  }));

  const inset = theme.sheetInset;
  const bottomPadding = Math.max(insets.bottom - inset, theme.spacing.md) + theme.spacing.xs;
  const hasHeader = Boolean(title || headerAction || dismissable);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissable ? onClose : () => {}}
      testID={testID}
    >
      <View style={[styles.root, { paddingBottom: keyboardHeight }]}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          {dismissable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.backdropPressable}
              onPress={onClose}
            />
          ) : (
            <View style={styles.backdropPressable} />
          )}
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[styles.panel(detent), { paddingBottom: bottomPadding }, panelStyle]}
        >
          <View style={styles.grabber} />
          {hasHeader ? (
            <View style={styles.header}>
              <View style={styles.headerSide}>
                {headerAction ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={headerAction.label}
                    onPress={headerAction.onPress}
                    style={styles.textButton}
                  >
                    <Text variant="body" tone="accent">
                      {headerAction.label}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.headerTitle}>
                {title ? (
                  <Text
                    variant="headline"
                    accessibilityRole="header"
                    numberOfLines={2}
                    style={styles.title}
                  >
                    {title}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.headerSide, styles.headerEnd]}>
                {dismissable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={4}
                    onPress={onClose}
                    style={styles.close}
                  >
                    <Icon name="close" size={16} tone="secondary" />
                  </Pressable>
                ) : null}
              </View>
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

const styles = StyleSheet.create((theme) => {
  const floating = theme.sheetInset > 0;
  return {
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.scrim,
    },
    backdropPressable: {
      flex: 1,
    },
    panel: (detent: SheetDetent) => ({
      marginHorizontal: theme.sheetInset,
      marginBottom: theme.sheetInset,
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: floating ? theme.radii.sheet : theme.radii.sheetAttached,
      borderTopRightRadius: floating ? theme.radii.sheet : theme.radii.sheetAttached,
      borderBottomLeftRadius: floating ? theme.radii.sheet : 0,
      borderBottomRightRadius: floating ? theme.radii.sheet : 0,
      paddingHorizontal: 20,
      gap: theme.spacing.sm,
      maxHeight: '92%',
      ...(detent === 'medium' && { height: '50%' }),
      ...(detent === 'large' && { height: '92%' }),
      ...theme.elevation.sheet,
    }),
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.borderStrong,
      marginTop: theme.spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
    },
    headerSide: {
      minWidth: theme.touchTarget,
      flexShrink: 0,
      alignItems: 'flex-start',
    },
    headerEnd: {
      alignItems: 'flex-end',
    },
    headerTitle: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xs,
    },
    title: {
      textAlign: 'center',
    },
    textButton: {
      minHeight: theme.touchTarget,
      minWidth: theme.touchTarget,
      justifyContent: 'center',
    },
    close: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
  };
});
