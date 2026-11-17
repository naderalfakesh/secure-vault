import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';

import { styles } from './PinMessage.styles';

export type PinMessageProps = {
  subtitle: string | null;
  /** The subtitle is an error. */
  alert: boolean;
};

/** The line under the title: guidance, or an error with a warning icon. */
export function PinMessage({ subtitle, alert }: PinMessageProps) {
  return (
    <View
      style={styles.subtitle}
      accessible={Boolean(subtitle)}
      accessibilityRole={alert ? 'alert' : undefined}
      accessibilityLiveRegion={alert ? 'assertive' : 'polite'}
      accessibilityLabel={subtitle ?? undefined}
    >
      {alert ? <Icon name="warning" size={16} tone="danger" /> : null}
      {subtitle ? (
        <Text
          variant="subheadline"
          tone={alert ? 'danger' : 'secondary'}
          align="center"
          style={styles.subtitleText}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
