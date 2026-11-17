import type { TextInputProps } from 'react-native';

export type SearchFieldProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Called after "Cancel" clears the field and drops focus. */
  onCancel?: () => void;
};
