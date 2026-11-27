import { ScrollView } from 'react-native';

import { Group, ListRow, Sheet } from '@/components/ui';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { t, tp } from '@/i18n';
import type { DocumentCategory } from '@/types';

import { styles } from './MoveSheet.styles';

type MoveSheetProps = {
  visible: boolean;
  count: number;
  busy: boolean;
  onClose: () => void;
  onMove: (category: DocumentCategory) => void;
};

export function MoveSheet({ visible, count, busy, onClose, onMove }: MoveSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('library.move.title', { documents: tp('format.documents', count) })}
      dismissable={!busy}
      scroll={false}
    >
      <ScrollView style={styles.scroller} contentContainerStyle={styles.body}>
        <Group header={t('library.move.collection')} separatorInset="content">
          {allCategories.map((category) => (
            <ListRow
              key={category}
              icon={categoryIcons[category]}
              tint="neutral"
              title={categoryLabel(category)}
              disabled={busy}
              onPress={() => onMove(category)}
            />
          ))}
        </Group>
      </ScrollView>
    </Sheet>
  );
}
