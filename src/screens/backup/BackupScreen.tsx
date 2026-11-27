import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { BackBar, Screen, TitledScroll } from '@/components/ui';
import { backupCopy as copy } from '@/features/backup/backupCopy';
import { CreateBackupSheet } from '@/features/backup/CreateBackupSheet';
import { useBackupActivity } from '@/features/backup/hooks/useBackupActivity';
import { RestoreSheet } from '@/features/backup/RestoreSheet';

import { CreateBackupCard, RestoreGroup } from './components';
import { useLastBackup } from './hooks/useLastBackup';
import { useRestorePick } from './hooks/useRestorePick';

// Sole restore entry point: no route param, deep link, or file association may trigger a restore.
export function BackupScreen() {
  const [lastBackup, setLastBackup] = useLastBackup();
  const [creating, setCreating] = useState(false);
  const pick = useRestorePick();
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
