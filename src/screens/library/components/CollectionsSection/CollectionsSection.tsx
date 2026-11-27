import { View } from 'react-native';

import { CollectionGrid, CollectionTile } from '@/components/ui';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { t } from '@/i18n';
import type { DocumentCategory } from '@/types';

import { SectionHeader } from '../SectionHeader';
import { styles } from './CollectionsSection.styles';

type CollectionsSectionProps = {
  counts: Record<DocumentCategory, number>;
  onOpen: (category: DocumentCategory) => void;
};

export function CollectionsSection({ counts, onOpen }: CollectionsSectionProps) {
  return (
    <View style={styles.section}>
      <SectionHeader title={t('library.collections')} />
      <View style={styles.inset}>
        <CollectionGrid>
          {allCategories
            .filter((category) => counts[category] > 0)
            .map((category) => (
              <CollectionTile
                key={category}
                name={categoryLabel(category)}
                count={counts[category]}
                icon={categoryIcons[category]}
                onPress={() => onOpen(category)}
                testID={`collection-${category}`}
              />
            ))}
        </CollectionGrid>
      </View>
    </View>
  );
}
