import { View } from 'react-native';

import { Icon } from '@/components/ui';
import { biometryIcon } from '@/features/auth/lockCopy';

import type { BiometryType } from '../../../../../modules/expo-vault';
import { styles } from './BiometricsBadge.styles';

export type BiometricsBadgeProps = {
  kind: BiometryType;
};

/** The face or fingerprint the step offers to turn on. */
export function BiometricsBadge({ kind }: BiometricsBadgeProps) {
  return (
    <View style={styles.badge}>
      <Icon name={kind === 'none' ? 'faceId' : biometryIcon(kind)} size={44} tone="accent" />
    </View>
  );
}
