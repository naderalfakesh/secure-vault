import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Palette } from '@/theme/colors';

import { useAnnouncement } from './announce';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** `warning` is the brass callout, e.g. "This can't be stopped." */
export type InlineAlertTone = 'danger' | 'info' | 'success' | 'warning';

export type InlineAlertProps = {
  tone?: InlineAlertTone;
  /** Optional bold lead before the message. */
  title?: string;
  message: string;
  icon?: IconName;
  /**
   * Announce the alert when it appears. Errors always are; turn this on for
   * callouts that appear mid-flow, such as the restore's point of no return.
   */
  announce?: boolean;
  testID?: string;
};

const looks: Record<InlineAlertTone, { fill: keyof Palette; ink: keyof Palette; icon: IconName }> =
  {
    danger: { fill: 'dangerMuted', ink: 'danger', icon: 'warning' },
    info: { fill: 'surfaceMuted', ink: 'textSecondary', icon: 'info' },
    success: { fill: 'successMuted', ink: 'success', icon: 'checkCircle' },
    warning: { fill: 'accentMuted', ink: 'accent', icon: 'warning' },
  };

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

const styles = StyleSheet.create((theme) => ({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 14,
    borderRadius: theme.radii.input,
  },
  text: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
  },
}));
