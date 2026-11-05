import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t } from '@/i18n';

import { Mark } from './Mark';
import { Text } from './Text';

/**
 * Solid privacy cover: the background colour,
 * the 80 pt mark, and the app name, so the app switcher shows nothing of the
 * vault. It is purely visual and hidden from assistive tech.
 */
export function PrivacyCover() {
  return (
    <View
      style={styles.cover}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="privacy-cover"
    >
      <Mark size={80} />
      <Text variant="headline">{t('common.appName')}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
}));
