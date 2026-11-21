import { StyleSheet } from 'react-native-unistyles';

import { TILE_CORNER } from './constants';

export const styles = StyleSheet.create(() => ({
  tile: (size: number, backgroundColor: string) => ({
    width: size,
    height: size,
    borderRadius: Math.round(size * TILE_CORNER),
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor,
  }),
}));
