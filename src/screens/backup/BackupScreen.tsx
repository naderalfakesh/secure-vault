import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { BackBar, Screen, TitledScroll } from '@/components/ui';
import { backupCopy as copy } from '@/features/backup/backupCopy';
import { CreateBackupSheet } from '@/features/backup/CreateBackupSheet';
import { RestoreSheet } from '@/features/backup/RestoreSheet';
import { useBackupActivity } from '@/hooks/useBackupActivity';

import { CreateBackupCard, RestoreGroup } from './components';
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
      <BackBar label={copy['hub.back']} onPress={() => router.back()} />
      <TitledScroll title={copy['hub.title']} showsVerticalScrollIndicator={false}>
        <CreateBackupCard
          earlier={earlier}
          lastBackup={lastBackup}
          disabled={blocked}
          onCreate={() => setCreating(true)}
        />

        <RestoreGroup earlier={earlier} disabled={blocked} onPick={pick.pickBackup} />
      </TitledScroll>

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
