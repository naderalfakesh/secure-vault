import type { TextInputProps } from 'react-native';

export type SearchFieldProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  onCancel?: () => void;
};
