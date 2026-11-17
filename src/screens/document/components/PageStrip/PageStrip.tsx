import { Pressable, ScrollView } from 'react-native';

import { DocumentImage } from '@/features/documents/DocumentImage';
import { t } from '@/i18n';

import { styles } from './PageStrip.styles';

type PageStripProps = {
  pages: readonly string[];
  page: number;
  onPageChange: (index: number) => void;
};

/** Thumbnails of every page; the one on the stage is marked. */
export function PageStrip({ pages, page, onPageChange }: PageStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      accessibilityRole="tablist"
      accessibilityLabel={t('viewer.pages')}
    >
      {pages.map((uri, index) => (
        <Pressable
          key={uri}
          accessibilityRole="tab"
          accessibilityLabel={t('viewer.pageLine', {
            number: index + 1,
            count: pages.length,
          })}
          accessibilityState={{ selected: index === page }}
          onPress={() => onPageChange(index)}
          style={styles.stripPage(index === page)}
        >
          <DocumentImage source={{ uri }} style={styles.stripImage} contentFit="cover" />
        </Pressable>
      ))}
    </ScrollView>
  );
}
