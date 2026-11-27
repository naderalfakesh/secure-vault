import { View } from 'react-native';

import { Button } from '@/components/ui';
import { t, tp } from '@/i18n';

import { styles } from './SelectionBar.styles';
import { selectionBarBottom } from '../../helpers';

type SelectionBarProps = {
  insetBottom: number;
  count: number;
  busy: boolean;
  onMove: () => void;
  onDelete: () => void;
};

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
