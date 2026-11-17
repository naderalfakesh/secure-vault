import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Icon, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './UnavailableLayout.styles';

export type UnavailableLayoutProps = {
  /** The explanation under the title. */
  children: ReactNode;
  /** The way on: the buttons at the bottom. */
  footer: ReactNode;
};

/** The lock tile and title over the explanation, with the actions at the bottom. */
export function UnavailableLayout({ children, footer }: UnavailableLayoutProps) {
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tile}>
          <Icon name="lock" size={32} tone="secondary" />
        </View>
        <Text variant="title2" align="center" accessibilityRole="header">
          {t('unavailable.title')}
        </Text>
        {children}
      </ScrollView>
      <View style={styles.footer} accessibilityLiveRegion="polite">
        {footer}
      </View>
    </Screen>
  );
}
