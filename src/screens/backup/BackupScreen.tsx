import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { backupCopy as copy } from '@/features/backup/backupCopy';
import { CreateBackupSheet } from '@/features/backup/CreateBackupSheet';
import { RestoreSheet } from '@/features/backup/RestoreSheet';
import { useBackupActivity } from '@/hooks/useBackupActivity';

import { styles } from './BackupScreen.styles';
import { BackupBar, CreateBackupCard, RestoreGroup } from './components';
import { useLastBackup } from './hooks/useLastBackup';
import { useRestorePick } from './hooks/useRestorePick';

/**
 * Settings › Backup: create a backup, and the app's only
 * restore entry. Nothing outside this screen starts a restore, and no
 * route, link or file type opens it with a file; it reads no parameters.
 */
export function BackupScreen() {
  const [lastBackup, setLastBackup] = useLastBackup();
  const [creating, setCreating] = useState(false);
  const pick = useRestorePick();
  // An export or restore, this screen's or one started before the last lock,
  // holds the service's one slot; nothing else may start until it ends.
  const running = useBackupActivity();
  const blocked = running !== null;
  const earlier = !creating && pick.restore === null ? running : null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <BackupBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          {copy['hub.title']}
        </Text>

        <CreateBackupCard
          earlier={earlier}
          lastBackup={lastBackup}
          disabled={blocked}
          onCreate={() => setCreating(true)}
        />

        <RestoreGroup earlier={earlier} disabled={blocked} onPick={pick.pickBackup} />
      </ScrollView>

      <CreateBackupSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onShared={setLastBackup}
      />
      <RestoreSheet
        key={pick.sheetKey}
        backup={pick.restore}
        onClose={pick.closeRestore}
        onChooseAnother={pick.chooseAnother}
        onRestored={pick.restored}
        onDismissed={pick.sheetGone}
      />
    </Screen>
  );
}
