import { View } from 'react-native';

import { Group, SegmentedControl } from '@/components/ui';
import { t } from '@/i18n';
import type { AppearancePreference } from '@/theme/appearance';

import { styles } from './AppearanceGroup.styles';
import { APPEARANCE_CHOICES } from '../../constants';

export type AppearanceGroupProps = {
  value: AppearancePreference;
  onChange: (value: AppearancePreference) => void;
};

export function AppearanceGroup({ value, onChange }: AppearanceGroupProps) {
  return (
    <Group header={t('settings.group.appearance')}>
      <View style={styles.appearance}>
        <SegmentedControl
          accessibilityLabel={t('settings.appearance')}
          options={APPEARANCE_CHOICES}
          value={value}
          onChange={onChange}
        />
      </View>
    </Group>
  );
}
