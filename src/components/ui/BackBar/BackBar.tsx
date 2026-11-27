import { View } from 'react-native';

import { Button } from '../Button';
import { styles } from './BackBar.styles';
import type { BackBarProps } from './types';

export function BackBar({ label, onPress, testID }: BackBarProps) {
  return (
    <View style={styles.bar}>
      <Button
        label={label}
        variant="plain"
        size="md"
        icon="back"
        onPress={onPress}
        testID={testID}
      />
    </View>
  );
}
