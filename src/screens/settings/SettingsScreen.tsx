import { router } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Group, ListRow, Screen, Text } from '@/components/ui';
import { useBiometricAvailability } from '@/features/auth/biometricAvailability';
import { tabBarClearance } from '@/features/navigation/tabBarClearance';
import { useSessionActions, useSessionState } from '@/features/session/SessionProvider';
import { t } from '@/i18n';
import { setAppearance, useAppearance } from '@/theme/appearance';

import {
  AboutGroup,
  AppearanceGroup,
  DangerGroup,
  EraseSheet,
  SecurityGroup,
  SuggestionsGroup,
} from './components';
import { useEraseVault } from './hooks/useEraseVault';
import { useOnDeviceModel } from './hooks/useOnDeviceModel';
import { styles } from './SettingsScreen.styles';

const openBackup = () => router.push('/settings/backup');

export function SettingsScreen() {
  const { settings, biometry } = useSessionState();
  const { lock, updateSettings } = useSessionActions();
  const insets = useSafeAreaInsets();
  const eraser = useEraseVault();
  const { closeErase } = eraser;
  const biometrics = useBiometricAvailability();
  const suggestions = useOnDeviceModel();
  const appearance = useAppearance();

  const backupFirst = useCallback(() => {
    closeErase();
    openBackup();
  }, [closeErase]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          {t('settings.title')}
        </Text>

        <SecurityGroup
          settings={settings}
          updateSettings={updateSettings}
          biometry={biometry}
          biometrics={biometrics}
          onLock={lock}
        />

        <Group header={t('settings.group.data')}>
          <ListRow
            icon="backup"
            title={t('settings.backup')}
            subtitle={t('settings.backup.subtitle')}
            onPress={openBackup}
          />
        </Group>

        <AppearanceGroup value={appearance} onChange={(option) => void setAppearance(option)} />

        <SuggestionsGroup
          engine={suggestions.engine}
          model={suggestions.model}
          downloading={suggestions.downloading}
          canDownload={suggestions.canDownload}
          onDownload={suggestions.downloadModel}
        />

        <AboutGroup />

        <DangerGroup
          busy={eraser.busy}
          running={eraser.running}
          disabled={eraser.blocked}
          onErase={eraser.openErase}
        />
      </ScrollView>

      <EraseSheet
        erase={eraser.erase}
        onClose={closeErase}
        onBackupFirst={backupFirst}
        onErase={eraser.clearAll}
      />
    </Screen>
  );
}
