import { View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { backupCopy as copy, lastCreatedLine } from '@/features/backup/backupCopy';
import type { BackupOperation } from '@/services/BackupService';
import { textScale } from '@/theme/tokens';

import { styles } from './CreateBackupCard.styles';

export type CreateBackupCardProps = {
  /** Backup work started before this screen opened, still running. */
  earlier: BackupOperation | null;
  lastBackup: Date | null;
  disabled: boolean;
  onCreate: () => void;
};

export function CreateBackupCard({
  earlier,
  lastBackup,
  disabled,
  onCreate,
}: CreateBackupCardProps) {
  return (
    <Card padded style={styles.card}>
      <View style={styles.cardIcon}>
        <Icon name="archive" size={22} tone="accent" />
      </View>
      {/* Capped: at AX5 its longest word did not fit and broke mid-word. */}
      <Text
        variant="title3"
        accessibilityRole="header"
        maxFontSizeMultiplier={textScale.barTitleMax}
      >
        {copy['hub.card.title']}
      </Text>
      <Text variant="subheadline" tone="secondary">
        {copy['hub.card.body']}
      </Text>
      <Button label={copy['hub.create']} icon="export" onPress={onCreate} disabled={disabled} />
      {earlier === 'export' ? (
        <Text variant="footnote" tone="secondary" style={styles.centred}>
          {copy['hub.exportRunning']}
        </Text>
      ) : lastBackup ? (
        <Text variant="footnote" tone="tertiary" style={styles.centred}>
          {lastCreatedLine(lastBackup)}
        </Text>
      ) : null}
    </Card>
  );
}
