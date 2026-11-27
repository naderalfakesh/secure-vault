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
  error?: string | null;
};
