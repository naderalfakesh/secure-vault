import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t } from '@/i18n';

import { useAnnouncement } from './announce';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BannerAction = { label: string; onPress: () => void };

export type BannerProps = {
  icon?: IconName;
  /** Bold lead sentence, e.g. "SecureVault locked while you were sharing." */
  lead: string;
  message?: string;
  /** Primary action first, e.g. "Share again". */
  actions?: readonly BannerAction[];
  /** Adds a "Dismiss" action. The banner has no timer; it stays until dismissed. */
  onDismiss?: () => void;
  testID?: string;
};

/** Persistent elevated notice (handover §4), e.g. the share-interrupted banner. */
export function Banner({
  icon = 'info',
  lead,
  message,
  actions = [],
  onDismiss,
  testID,
}: BannerProps) {
  const spoken = message ? `${lead} ${message}` : lead;
  useAnnouncement(spoken);

  return (
    <View style={styles.card} testID={testID}>
      <View
        accessible
        accessibilityLabel={spoken}
        accessibilityLiveRegion="polite"
        style={styles.body}
      >
        <Icon name={icon} size={20} tone="accent" />
        <Text variant="subheadline" style={styles.text}>
          <Text variant="subheadline" style={styles.lead}>
            {lead}
          </Text>
          {message ? ` ${message}` : null}
        </Text>
      </View>
      {actions.length || onDismiss ? (
        <View style={styles.actions}>
          {actions.map((action, index) => (
            <Button
              key={action.label}
              label={action.label}
              onPress={action.onPress}
              size="md"
              variant={index === 0 ? 'tinted' : 'plain'}
            />
          ))}
          {onDismiss ? (
            <Button label={t('common.dismiss')} onPress={onDismiss} size="md" variant="plain" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surfaceElevated,
    ...theme.elevation.card,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  text: {
    flex: 1,
  },
  lead: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
}));
