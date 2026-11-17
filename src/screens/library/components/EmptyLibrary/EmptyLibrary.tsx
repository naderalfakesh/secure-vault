import { View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './EmptyLibrary.styles';

type EmptyLibraryProps = {
  bottomSpace: number;
  onAdd: () => void;
};

/** First run (or after Delete everything): one clear action, nothing else. */
export function EmptyLibrary({ bottomSpace, onAdd }: EmptyLibraryProps) {
  return (
    <View style={[styles.center, { paddingBottom: bottomSpace }]}>
      <EmptyState
        icon="scan"
        title={t('library.empty.title')}
        description={t('library.empty.body')}
        actionLabel={t('library.empty.scan')}
        onAction={onAdd}
        secondaryActionLabel={t('library.empty.import')}
        onSecondaryAction={onAdd}
      />
    </View>
  );
}
