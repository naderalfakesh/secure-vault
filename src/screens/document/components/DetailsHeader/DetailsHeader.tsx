import { View } from 'react-native';

import { Button, Chip, Text } from '@/components/ui';
import type { ExtractedField } from '@/data/DocumentRepository';
import { categoryLabel } from '@/features/documents/categories';
import { t } from '@/i18n';
import type { Document } from '@/types';
import { isolate } from '@/utils/bidi';
import { formatExpiry } from '@/utils/format';

import { styles } from './DetailsHeader.styles';

type DetailsHeaderProps = {
  document: Document;
  /** The recognised expiry date, if any. */
  expires: ExtractedField | undefined;
  onEdit: () => void;
};

/** The title, collection and expiry chips, and Edit. */
export function DetailsHeader({ document, expires, onEdit }: DetailsHeaderProps) {
  return (
    <View style={styles.detailsHeader}>
      <View style={styles.detailsTitle}>
        {/* A document name can be one long token: it wraps instead. */}
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
