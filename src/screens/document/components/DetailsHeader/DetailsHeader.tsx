import { View } from 'react-native';

import { Button, Chip, Text } from '@/components/ui';
import { categoryLabel } from '@/features/documents/categories';
import { t } from '@/i18n';
import type { ExtractedField, Document } from '@/types';
import { isolate } from '@/utils/bidi';
import { formatExpiry } from '@/utils/format';

import { styles } from './DetailsHeader.styles';

type DetailsHeaderProps = {
  document: Document;
  expires: ExtractedField | undefined;
  onEdit: () => void;
};

export function DetailsHeader({ document, expires, onEdit }: DetailsHeaderProps) {
  return (
    <View style={styles.detailsHeader}>
      <View style={styles.detailsTitle}>
        <Text variant="title2" accessibilityRole="header" fit={false}>
          {isolate(document.title)}
        </Text>
        <View style={styles.chips}>
          <Chip label={categoryLabel(document.category)} />
          {expires ? <Chip variant="status" label={formatExpiry(expires.value)} /> : null}
        </View>
      </View>
      <Button label={t('viewer.edit.button')} variant="secondary" size="md" onPress={onEdit} />
    </View>
  );
}
