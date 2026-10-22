import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
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

import { t } from '@/i18n';
import { textScale } from '@/theme/tokens';

import { GlassBackground, OnGlassContext, useGlass } from './Glass';
import { Icon } from './Icon';
import { Text } from './Text';
import { useLargeText } from './useLargeText';

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
  /**
   * False hides the close button while the sheet stays dismissable, for a
   * sheet whose header action is already Cancel (one way out, not two).
   */
  closeButton?: boolean;
  /** `auto` fits the content; `medium` and `large` fix the height. */
  detent?: SheetDetent;
  /**
   * The body scrolls when it is taller than the sheet, as it is at the
   * largest text sizes (§10.2). Turn it off only when the body is itself a
   * scroll view or list.
   */
  scroll?: boolean;
  /**
   * Called once the modal has finished going away, so the next system
   * presentation (a picker) is not handed a view controller being dismissed.
   * iOS only; React Native's Modal reports no dismissal on Android.
   */
  onDismissed?: () => void;
  testID?: string;
}>;

const CLOSE_MS = 200;
const SLIDE = 40;

/**
 * Bottom sheet for choices, confirmations, and progress (handover §4). On iOS
 * it floats 8 pt in from the edges; on Android it is attached to the bottom.
 * On iOS 26+ the panel is Liquid Glass (F16); on Android, older iOS, and with
 * Reduce Transparency on it is the solid elevated surface. The privacy cover
 * still covers it: it is drawn in a full-window overlay above every modal.
 */
export function Sheet({
  visible,
  onClose,
  title,
  headerAction,
  dismissable = true,
  closeButton = true,
  detent = 'auto',
  scroll = true,
  children,
  onDismissed,
  testID,
}: SheetProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const keyboardHeight = useKeyboardHeight();
  const glass = useGlass();

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
  const hasHeaderControls = Boolean(headerAction || (dismissable && closeButton));
  const stacked = useLargeText();
  // A bar title: it stops growing at 1.6× and shrinks to keep its words whole.
  const titleText = title ? (
    <Text
      variant="headline"
      accessibilityRole="header"
      maxFontSizeMultiplier={textScale.barTitleMax}
      fit
      style={styles.title}
    >
      {title}
    </Text>
  ) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissable ? onClose : () => {}}
      onDismiss={onDismissed}
      testID={testID}
    >
      <View style={[styles.root, { paddingBottom: keyboardHeight }]}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          {dismissable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.backdropPressable}
              onPress={onClose}
            />
          ) : (
            <View style={styles.backdropPressable} />
          )}
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel(detent),
            glass && styles.glassPanel,
            { paddingBottom: bottomPadding },
            panelStyle,
          ]}
        >
          {glass ? <GlassBackground style={styles.glassShape} /> : null}
          <View style={styles.grabber} />
          {hasHeader ? (
            <>
              {stacked && !hasHeaderControls ? null : (
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
                  <View style={styles.headerTitle}>{stacked ? null : titleText}</View>
                  <View style={[styles.headerSide, styles.headerEnd]}>
                    {dismissable && closeButton ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.close')}
                        hitSlop={4}
                        onPress={onClose}
                        style={styles.close}
                      >
                        <Icon name="close" size={16} tone="secondary" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )}
              {/* At the largest text sizes the title gets a row of its own, the
                full width of the sheet, instead of the gap between the controls. */}
              {stacked && titleText ? <View style={styles.stackedTitle}>{titleText}</View> : null}
            </>
          ) : null}
          <OnGlassContext.Provider value={glass}>
            {scroll ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={false}
              >
                {children}
              </ScrollView>
            ) : (
              children
            )}
          </OnGlassContext.Provider>
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
    glassPanel: {
      backgroundColor: 'transparent',
    },
    // The glass takes the panel's corners.
    glassShape: {
      borderTopLeftRadius: floating ? theme.radii.sheet : theme.radii.sheetAttached,
      borderTopRightRadius: floating ? theme.radii.sheet : theme.radii.sheetAttached,
      borderBottomLeftRadius: floating ? theme.radii.sheet : 0,
      borderBottomRightRadius: floating ? theme.radii.sheet : 0,
    },
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
    stackedTitle: {
      alignItems: 'center',
    },
    textButton: {
      minHeight: theme.touchTarget,
      minWidth: theme.touchTarget,
      justifyContent: 'center',
    },
    body: {
      flexShrink: 1,
      flexGrow: 0,
    },
    bodyContent: {
      gap: theme.spacing.sm,
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
