import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useAnnouncement } from '../announce';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { looks } from './constants';
import type { InlineAlertProps } from './types';
import { styles } from './InlineAlert.styles';

/** Inline callout: colour, icon, and text together, never colour alone. */
export function InlineAlert({
  tone = 'info',
  title,
  message,
  icon,
  announce,
  testID,
}: InlineAlertProps) {
  const { theme } = useUnistyles();
  const look = looks[tone];
  const isError = tone === 'danger';
  const spoken = title ? `${title} ${message}` : message;
  const speaks = announce ?? isError;
  useAnnouncement(spoken, speaks);

  return (
    <View
      accessible
      accessibilityRole={isError ? 'alert' : undefined}
      accessibilityLabel={spoken}
      accessibilityLiveRegion={isError ? 'assertive' : speaks ? 'polite' : 'none'}
      style={[styles.box, { backgroundColor: theme.colors[look.fill] }]}
      testID={testID}
    >
      <Icon name={icon ?? look.icon} size={20} color={theme.colors[look.ink]} />
      <Text variant="subheadline" style={styles.text}>
        {title ? <Text variant="subheadline" style={styles.title}>{`${title} `}</Text> : null}
        {message}
      </Text>
    </View>
  );
}
