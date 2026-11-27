import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { Sheet } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './DetailsSheet.styles';

type DetailsSheetProps = {
  visible: boolean;
  editing: boolean;
  onClose: () => void;
  onCancelEdit: () => void;
  children: ReactNode;
};

export function DetailsSheet({
  visible,
  editing,
  onClose,
  onCancelEdit,
  children,
}: DetailsSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? t('viewer.edit.title') : undefined}
      scroll={false}
      headerAction={editing ? { label: t('viewer.edit.cancel'), onPress: onCancelEdit } : undefined}
      closeButton={!editing}
    >
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Sheet>
  );
}
