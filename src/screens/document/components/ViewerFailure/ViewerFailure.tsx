import { Stack } from 'expo-router';
import { View } from 'react-native';

import { BackBar, Button, Icon, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './ViewerFailure.styles';
import type { LoadFailure } from '../../types';

type ViewerFailureProps = {
  failure: LoadFailure;
  onBack: () => void;
};

/** A document that is gone or cannot be read, with the way back. */
export function ViewerFailure({ failure, onBack }: ViewerFailureProps) {
  const missing = failure.kind === 'missing';
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <BackBar label={t('viewer.library')} onPress={onBack} />
      <View style={styles.failure} accessibilityRole="alert">
        <View style={styles.failureIcon}>
          <Icon name={missing ? 'document' : 'warning'} size={30} tone="secondary" />
        </View>
        <Text variant="title3" align="center" accessibilityRole="header">
          {t(missing ? 'viewer.missing.title' : 'viewer.unreadable.title')}
        </Text>
        <Text variant="callout" tone="secondary" align="center">
          {missing ? t('viewer.missing.body') : (failure.detail ?? t('viewer.unreadable.body'))}
        </Text>
        <Button
          label={t(missing ? 'viewer.missing.button' : 'viewer.unreadable.button')}
          onPress={onBack}
        />
      </View>
    </Screen>
  );
}
