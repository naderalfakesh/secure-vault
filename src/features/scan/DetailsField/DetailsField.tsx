import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

import { styles } from './DetailsField.styles';

export type DetailsFieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

/** A labelled group in the details form, with an optional hint under it. */
export function DetailsField({ label, hint, children }: DetailsFieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
