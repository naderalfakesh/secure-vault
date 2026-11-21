import { View } from 'react-native';

import { Button } from '../Button';
import { styles } from './BackBar.styles';
import type { BackBarProps } from './types';

/** The row under the status bar that takes you back to where you came from. */
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
