import { Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { textScale } from '@/theme/tokens';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { useLargeText } from '../useLargeText';
import { styles } from './SheetHeader.styles';
import type { SheetHeaderProps } from './types';

/** The header row: a leading text action, the title, and the close button. */
export function SheetHeader({
  title,
  headerAction,
  dismissable,
  closeButton,
  onClose,
}: SheetHeaderProps) {
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
  );
}
