import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './LibraryTitle.styles';

/** The large "Library" title; at large text its actions wrap below it. */
export function LibraryTitle({ children }: { children?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
        {t('library.title')}
      </Text>
      {children}
    </View>
  );
}
