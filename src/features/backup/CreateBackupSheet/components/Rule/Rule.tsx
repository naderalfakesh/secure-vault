import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { t } from '@/i18n';

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
      accessibilityLabel={t(met ? 'backup.create.rule.met' : 'backup.create.rule.notMet', {
        rule: label,
      })}
      style={styles.rule}
    >
      <Icon name={met ? 'check' : 'info'} size={16} tone={met ? 'success' : 'tertiary'} />
      <Text variant="footnote" tone={met ? 'primary' : 'secondary'} style={styles.ruleText}>
        {label}
      </Text>
    </View>
  );
}
