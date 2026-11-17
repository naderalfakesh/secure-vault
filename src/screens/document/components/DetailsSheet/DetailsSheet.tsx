import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { Sheet } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './DetailsSheet.styles';

type DetailsSheetProps = {
  visible: boolean;
  /** The edit form is showing instead of the details. */
  editing: boolean;
  onClose: () => void;
  onCancelEdit: () => void;
  children: ReactNode;
};

/** The sheet behind Details and More: the document's details or its edit form. */
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
      // The details body is its own scroll view.
      scroll={false}
      headerAction={editing ? { label: t('viewer.edit.cancel'), onPress: onCancelEdit } : undefined}
      detent={editing ? 'large' : 'auto'}
    >
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </Sheet>
  );
}
