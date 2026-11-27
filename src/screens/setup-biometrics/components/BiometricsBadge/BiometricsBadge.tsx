import { View } from 'react-native';

import { Icon } from '@/components/ui';
import { biometryIcon } from '@/features/auth/lockCopy';
import type { BiometryType } from '@modules/expo-vault';

import { styles } from './BiometricsBadge.styles';

type BiometricsBadgeProps = {
  kind: BiometryType;
};

export function BiometricsBadge({ kind }: BiometricsBadgeProps) {
  return (
    <View style={styles.badge}>
      <Icon name={kind === 'none' ? 'faceId' : biometryIcon(kind)} size={44} tone="accent" />
    </View>
  );
}
