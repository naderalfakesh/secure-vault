import { View } from 'react-native';

import { Button } from '@/components/ui';
import { t, tp } from '@/i18n';

import { styles } from './SelectionBar.styles';
import { selectionBarBottom } from '../../helpers';

type SelectionBarProps = {
  /** The bottom safe-area inset. */
  insetBottom: number;
  count: number;
  busy: boolean;
  onMove: () => void;
  onDelete: () => void;
};

/** Takes the tab bar's place while selecting: Move to… and Delete only. */
export function SelectionBar({ insetBottom, count, busy, onMove, onDelete }: SelectionBarProps) {
  const disabled = count === 0 || busy;
  return (
    <View style={[styles.bar, { bottom: selectionBarBottom(insetBottom) }]}>
      <Button
        label={t('library.moveTo')}
        variant="plain"
        icon="folder"
        disabled={disabled}
        onPress={onMove}
      />
      <Button
        // Nothing selected: a plain disabled "Delete", never "Delete 0".
        label={count > 0 ? t('library.deleteCount', { count }) : t('common.delete')}
        accessibilityLabel={
          count > 0
            ? t('library.deleteLabel', { documents: tp('format.documents', count) })
            : t('common.delete')
        }
        variant="plainDestructive"
        icon="trash"
        disabled={disabled}
        onPress={onDelete}
      />
    </View>
  );
}
