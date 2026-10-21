import { useRef, useState } from 'react';
import {
  Pressable,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@/i18n';

import { Icon } from './Icon';
import { Text } from './Text';

export type SearchFieldProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Called after "Cancel" clears the field and drops focus. */
  onCancel?: () => void;
};

/**
 * 44 pt pill search field (handover §4): leading search glyph, a clear button
 * once there is text, and "Cancel" while focused.
 */
export function SearchField({
  value,
  onChangeText,
  onCancel,
  placeholder = t('ui.search.placeholder'),
  accessibilityLabel = t('ui.search.label'),
  onFocus,
  onBlur,
  ...props
}: SearchFieldProps) {
  const { theme } = useUnistyles();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Icon name="search" size={18} tone="tertiary" />
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel={accessibilityLabel}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="never"
          {...props}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={styles.input}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('ui.search.clear')}
            // 18 pt glyph + 13 pt on each side = a 44 pt target.
            hitSlop={13}
            onPress={() => {
              onChangeText('');
              input.current?.focus();
            }}
            style={styles.clear}
          >
            <Icon name="close" size={12} color={theme.colors.surface} />
          </Pressable>
        ) : null}
      </View>
      {focused ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={() => {
            onChangeText('');
            input.current?.blur();
            setFocused(false);
            onCancel?.();
          }}
          style={styles.cancel}
        >
          <Text variant="body" tone="accent">
            {t('common.cancel')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    writingDirection: 'auto',
    paddingVertical: theme.spacing.xs,
  },
  clear: {
    width: 18,
    height: 18,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    minHeight: theme.touchTarget,
    justifyContent: 'center',
  },
}));
