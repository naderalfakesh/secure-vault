import { View } from 'react-native';

import { t } from '@/i18n';

import { useAnnouncement } from '../announce';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Text } from '../Text';
import type { BannerProps } from './types';
import { styles } from './Banner.styles';

/** Persistent elevated notice, e.g. the share-interrupted banner. */
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
