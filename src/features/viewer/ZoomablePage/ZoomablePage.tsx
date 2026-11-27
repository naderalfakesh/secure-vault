import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { DocumentImage } from '@/features/documents/DocumentImage';

import { IMAGE_TRANSITION_MS, NO_SWIPE } from './constants';
import type { ZoomablePageProps } from './types';
import { useZoomGestures } from './useZoomGestures';
import { useZoomState } from './useZoomState';
import { styles } from './ZoomablePage.styles';

export function ZoomablePage({
  uri,
  label,
  onZoomChange,
  onDismiss,
  onTap,
  dismissProgress,
  canSwipe = NO_SWIPE,
  onEdgeSwipe,
  testID = 'zoomable-page',
}: ZoomablePageProps) {
  const { zoomed, reportZoom, reportEdgeSwipe } = useZoomState({ onZoomChange, onEdgeSwipe });
  const { gesture, pageStyle, width, height } = useZoomGestures({
    testID,
    zoomed,
    reportZoom,
    reportEdgeSwipe,
    onDismiss,
    onTap,
    dismissProgress,
    canSwipe,
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, { width, height }, pageStyle]}>
        <DocumentImage
          source={{ uri }}
          style={styles.image}
          contentFit="contain"
          transition={IMAGE_TRANSITION_MS}
          accessibilityLabel={label}
          accessible
        />
      </Animated.View>
    </GestureDetector>
  );
}
