import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui';
import { backupCopy as copy } from '@/features/backup/backupCopy';

import { styles } from './BackupBar.styles';

export function BackupBar() {
  return (
    <View style={styles.bar}>
      <Button
        label={copy['hub.back']}
        variant="plain"
        size="md"
        icon="back"
        onPress={() => router.back()}
      />
    </View>
  );
}
