import { useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@/i18n';

import { useOnGlass } from './Glass';
import { Icon } from './Icon';
import { Text } from './Text';

export type PassphraseFieldProps = Omit<
  TextInputProps,
  | 'style'
  | 'value'
  | 'onChangeText'
  | 'secureTextEntry'
  | 'autoCorrect'
  | 'autoCapitalize'
  | 'spellCheck'
> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Error under the field; also turns the border danger. */
  error?: string | null;
};

/**
 * Secure passphrase entry. Any script is accepted; the text
 * aligns to the start and takes its direction from what is typed. Nothing is
 * corrected, capitalised, or spell-checked.
 */
export function PassphraseField({
  label,
  value,
  onChangeText,
  error,
  onFocus,
  onBlur,
  ...props
}: PassphraseFieldProps) {
  const { theme } = useUnistyles();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const state = error ? 'error' : focused ? 'focused' : 'idle';
  // On a glass sheet the field is a solid surface with a hairline edge, so
  // the glass behind it never tints the field or bleeds around its corners.
  const onGlass = useOnGlass();

  return (
    <View style={styles.field}>
      <Text variant="footnote" tone="secondary" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.box(state), onGlass && styles.solid(state)]} testID="passphrase-box">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          secureTextEntry={!visible}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          placeholderTextColor={theme.colors.textTertiary}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? t('ui.passphrase.hide') : t('ui.passphrase.show')}
          onPress={() => setVisible((shown) => !shown)}
          style={styles.toggle}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={20} tone="secondary" />
        </Pressable>
      </View>
      {error ? (
        <View accessible accessibilityRole="alert" style={styles.error}>
          <Icon name="warning" size={14} tone="danger" />
          <Text variant="footnote" tone="danger" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    gap: 6,
  },
  label: {
    fontWeight: '600',
    marginHorizontal: theme.spacing.xxs,
  },
  box: (state: 'idle' | 'focused' | 'error') => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 52,
    paddingStart: 14,
    paddingEnd: 4,
    borderRadius: theme.radii.input,
    borderWidth: 1.5,
    borderColor:
      state === 'error'
        ? theme.colors.danger
        : state === 'focused'
          ? theme.colors.primary
          : 'transparent',
    backgroundColor: theme.colors.surfaceMuted,
  }),
  solid: (state: 'idle' | 'focused' | 'error') => ({
    backgroundColor: theme.colors.surface,
    ...(state === 'idle' && { borderColor: theme.colors.border }),
  }),
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    writingDirection: 'auto',
    paddingVertical: theme.spacing.sm,
  },
  toggle: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    marginHorizontal: theme.spacing.xxs,
  },
  errorText: {
    flex: 1,
  },
}));
