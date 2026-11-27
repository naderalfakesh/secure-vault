import { View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';

import { styles } from './StatusIcon.styles';

type StatusIconProps = {
  icon: IconName;
  tone: 'danger' | 'secondary';
};

export function StatusIcon({ icon, tone }: StatusIconProps) {
  return (
    <View style={styles.well(tone === 'danger' ? 'dangerMuted' : 'surfaceMuted')}>
      <Icon name={icon} size={28} tone={tone} />
    </View>
  );
}
