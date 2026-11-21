import { View } from 'react-native';

import { Group, Skeleton } from '@/components/ui';

import { styles } from './LibrarySkeleton.styles';
import { SKELETON_WIDTHS } from '../../constants';

/** Placeholder rows while a slow index loads; silent for assistive tech. */
export function LibrarySkeleton() {
  return (
    <View style={styles.inset} accessibilityElementsHidden testID="library-loading">
      <Group>
        {SKELETON_WIDTHS.map((width) => (
          <View key={width} style={styles.row}>
            <Skeleton width={44} height={56} borderRadius={8} />
            <View style={styles.text}>
              <Skeleton width={`${width}%`} height={14} />
              <Skeleton width={`${Math.round(width * 0.66)}%`} height={10} />
            </View>
          </View>
        ))}
      </Group>
    </View>
  );
}
