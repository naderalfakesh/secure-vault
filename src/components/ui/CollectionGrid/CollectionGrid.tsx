import { Children, type ReactNode } from 'react';
import { View } from 'react-native';

import { styles } from './CollectionGrid.styles';
import type { CollectionGridProps } from './types';

export function CollectionGrid({ children }: CollectionGridProps) {
  const tiles = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let index = 0; index < tiles.length; index += 2) {
    rows.push(tiles.slice(index, index + 2));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.gridRow}>
          {row.map((tile, column) => (
            <View key={column} style={styles.cell}>
              {tile}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}
