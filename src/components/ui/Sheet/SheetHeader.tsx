import { Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { textScale } from '@/theme/tokens';

import { useLargeText } from '../hooks/useLargeText';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { styles } from './SheetHeader.styles';
import type { SheetHeaderProps } from './types';

export function SheetHeader({
  title,
  headerAction,
  dismissable,
  closeButton,
  onClose,
}: SheetHeaderProps) {
  const hasHeaderControls = Boolean(headerAction || (dismissable && closeButton));
  const stacked = useLargeText();
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
      {stacked && titleText ? <View style={styles.stackedTitle}>{titleText}</View> : null}
    </>
  );
}
