import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';

import { styles } from './Rule.styles';

export type RuleProps = {
  met: boolean;
  label: string;
};

/** One enforced passphrase rule, with whether it is met. */
export function Rule({ met, label }: RuleProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${met ? 'met' : 'not met'}`}
      style={styles.rule}
    >
      <Icon name={met ? 'check' : 'info'} size={16} tone={met ? 'success' : 'tertiary'} />
      <Text variant="footnote" tone={met ? 'primary' : 'secondary'} style={styles.ruleText}>
        {label}
      </Text>
    </View>
  );
}
