import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';

import { styles } from './PinMessage.styles';

export type PinMessageProps = {
  message: string;
  /** An error or the easy-PIN warning. */
  alerting: boolean;
  /** An error: red and assertive. */
  failing: boolean;
  /** The easy-PIN warning, in the warning tone. */
  warning: boolean;
};

/** The hint, warning or error under the title, read out as one line. */
export function PinMessage({ message, alerting, failing, warning }: PinMessageProps) {
  return (
    <View
      style={styles.message}
      accessible
      accessibilityRole={alerting ? 'alert' : undefined}
      accessibilityLiveRegion={failing ? 'assertive' : 'polite'}
      accessibilityLabel={message}
    >
      {alerting ? <Icon name="warning" size={16} tone={failing ? 'danger' : 'warning'} /> : null}
      <Text
        variant="subheadline"
        tone={failing ? 'danger' : warning ? 'warning' : 'secondary'}
        align="center"
        style={styles.messageText}
      >
        {message}
      </Text>
    </View>
  );
}
