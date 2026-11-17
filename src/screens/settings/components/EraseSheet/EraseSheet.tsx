import { Pressable, View } from 'react-native';

import { Button, Icon, Sheet, Text } from '@/components/ui';
import { t } from '@/i18n';

import { eraseSubject } from '../../helpers';
import type { EraseRequest } from '../../types';
import { styles } from './EraseSheet.styles';

export type EraseSheetProps = {
  /** Null closes the sheet. */
  erase: EraseRequest | null;
  onClose: () => void;
  onBackupFirst: () => void;
  onErase: () => void;
};

/** Delete everything: what it erases, a way to back up first, then the confirmation. */
export function EraseSheet({ erase, onClose, onBackupFirst, onErase }: EraseSheetProps) {
  return (
    <Sheet visible={erase !== null} onClose={onClose}>
      <View style={styles.erase}>
        <View style={styles.eraseIcon}>
          <Icon name="trash" size={26} tone="danger" />
        </View>
        <Text variant="title2" accessibilityRole="header">
          {t('settings.erase.title')}
        </Text>
        <Text variant="callout" tone="secondary">
          {t('settings.erase.body', { subject: eraseSubject(erase?.count ?? null) })}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('settings.erase.backupFirst')}
          onPress={onBackupFirst}
          style={styles.link}
        >
          <Text variant="callout" tone="accent" style={styles.linkText}>
            {t('settings.erase.backupFirst')}
          </Text>
        </Pressable>
        <Button
          label={t('settings.erase')}
          variant="destructive"
          // The native alert opens over the sheet; the sheet closes once confirmed.
          onPress={onErase}
        />
        <Button label={t('common.cancel')} variant="plain" onPress={onClose} />
      </View>
    </Sheet>
  );
}
