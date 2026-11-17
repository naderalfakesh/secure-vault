import type { TextInputProps } from 'react-native';

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
