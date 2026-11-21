import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { t } from '@/i18n';

import { useOnGlass } from '../Glass';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { styles } from './PassphraseField.styles';
import type { PassphraseFieldProps } from './types';

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
