import { Modal, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { t } from '@/i18n';

import { GlassBackground, OnGlassContext, useGlass } from '../Glass';
import { styles } from './Sheet.styles';
import { SheetHeader } from './SheetHeader';
import type { SheetProps } from './types';
import { useKeyboardHeight } from './useKeyboardHeight';
import { useSheetMotion } from './useSheetMotion';

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
  const { backdropStyle, panelStyle } = useSheetMotion(visible);
  const keyboardHeight = useKeyboardHeight();
  const glass = useGlass();

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
            <SheetHeader
              title={title}
              headerAction={headerAction}
              dismissable={dismissable}
              closeButton={closeButton}
              onClose={onClose}
            />
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
