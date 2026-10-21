import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type PaperThumbnailProps = {
  width?: number;
  height?: number;
  radius?: number;
  /** A decrypted thumbnail image; the paper placeholder shows until it is ready. */
  children?: ReactNode;
};

// Text lines drawn on the paper placeholder. Paper stays light in dark mode, so
// the lines keep one grey too.
const PAPER_LINE = '#D5D8E0';
const LINES = ['100%', '70%', '100%', '50%'] as const;

/** Scanned-paper placeholder: the warmest colour on screen (handover §2). */
export function PaperThumbnail({
  width = 44,
  height = 56,
  radius = 8,
  children,
}: PaperThumbnailProps) {
  return (
    <View
      style={[styles.paper, { width, height, borderRadius: radius }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children ?? (
        <View style={styles.lines}>
          {LINES.map((lineWidth, index) => (
            <View key={index} style={[styles.line, { width: lineWidth }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  paper: {
    backgroundColor: theme.colors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  lines: {
    flex: 1,
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 7,
  },
  line: {
    height: 3,
    borderRadius: 2,
    backgroundColor: PAPER_LINE,
  },
}));
