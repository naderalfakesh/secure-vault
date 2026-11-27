import { StyleSheet } from 'react-native-unistyles';

import type { SheetDetent } from './types';

export const styles = StyleSheet.create((theme) => {
  const floating = theme.sheetInset > 0;
  return {
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.scrim,
    },
    backdropPressable: {
      flex: 1,
    },
    panel: (detent: SheetDetent) => ({
      marginHorizontal: theme.sheetInset,
      marginBottom: theme.sheetInset,
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: floating ? theme.radii.sheet : theme.radii.sheetAttached,
      borderTopRightRadius: floating ? theme.radii.sheet : theme.radii.sheetAttached,
      borderBottomLeftRadius: floating ? theme.radii.sheet : 0,
      borderBottomRightRadius: floating ? theme.radii.sheet : 0,
      paddingHorizontal: theme.layout.titleMargin,
      gap: theme.spacing.sm,
      maxHeight: '92%',
      ...(detent === 'medium' && { height: '50%' }),
      ...(detent === 'large' && { height: '92%' }),
      ...theme.elevation.sheet,
    }),
    glassPanel: {
      backgroundColor: 'transparent',
    },
    glassShape: {
      borderTopLeftRadius: floating ? theme.radii.sheet : theme.radii.sheetAttached,
      borderTopRightRadius: floating ? theme.radii.sheet : theme.radii.sheetAttached,
      borderBottomLeftRadius: floating ? theme.radii.sheet : 0,
      borderBottomRightRadius: floating ? theme.radii.sheet : 0,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.borderStrong,
      marginTop: theme.spacing.xs,
    },
    body: {
      flexShrink: 1,
      flexGrow: 0,
    },
    bodyContent: {
      gap: theme.spacing.sm,
    },
  };
});
