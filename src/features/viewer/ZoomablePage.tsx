import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { DocumentImage } from '@/features/documents/DocumentImage';
import { edgeSwipe, type SwipeDirection } from '@/utils/pager';

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
const PINCH_MIN_SCALE = 0.6;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_THRESHOLD = 110;

export interface ZoomablePageProps {
  uri: string;
  /** Screen-reader label for the page. */
  label: string;
  /** Fires when the page moves between rest scale and zoomed, so the pager can lock. */
  onZoomChange: (zoomed: boolean) => void;
  /** A vertical drag past the threshold at rest scale. */
  onDismiss: () => void;
  onTap: () => void;
  /** Progress of a dismiss drag, 0 to 1, for the pager's backdrop. */
  dismissProgress: SharedValue<number>;
  /** Whether a page lies beyond each edge, for a drag past the edge while zoomed. */
  canSwipe?: { left: boolean; right: boolean };
  /** A zoomed drag pulled past an edge: the page has zoomed out, turn to the neighbour. */
  onEdgeSwipe?: (direction: SwipeDirection) => void;
  /** Prefix for the gestures' test ids. */
  testID?: string;
}

const NO_SWIPE = { left: false, right: false };

/**
 * One page of the viewer. Pinch to zoom around the fingers, pan while zoomed,
 * double-tap to toggle, drag down at rest to dismiss. Adapted from the
 * image-toolset-modern viewer without its thumbnail morph.
 */
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
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const dismissY = useSharedValue(0);
  // Mirrors the scale on the JS side so the zoomed pan only exists while
  // zoomed. At rest it must not activate at all: an active pan claims the
  // touch, and the pager underneath never sees the horizontal swipe.
  const [zoomed, setZoomed] = useState(false);
  // A new page starts at rest: a page zoomed when it was swapped drops the
  // zoom here, and the effect below tells the pager.
  const [shownUri, setShownUri] = useState(uri);
  const [restAfterSwap, setRestAfterSwap] = useState(false);
  if (shownUri !== uri) {
    setShownUri(uri);
    if (zoomed) {
      setZoomed(false);
      setRestAfterSwap(true);
    }
  }

  const reportZoom = useCallback(
    (value: boolean) => {
      setZoomed(value);
      setRestAfterSwap(false);
      onZoomChange(value);
    },
    [onZoomChange],
  );

  const reportEdgeSwipe = useCallback(
    (direction: SwipeDirection) => {
      reportZoom(false);
      onEdgeSwipe?.(direction);
    },
    [reportZoom, onEdgeSwipe],
  );

  useEffect(() => {
    // A new page starts at rest.
    scale.set(MIN_SCALE);
    translateX.set(0);
    translateY.set(0);
    dismissY.set(0);
  }, [uri, scale, translateX, translateY, dismissY]);

  useEffect(() => {
    if (restAfterSwap) onZoomChange(false);
  }, [restAfterSwap, onZoomChange]);

  const clampToBounds = (value: number, size: number, currentScale: number) => {
    'worklet';
    const bound = ((currentScale - 1) * size) / 2;
    return clamp(value, -bound, bound);
  };

  const settle = () => {
    'worklet';
    const s = scale.get();
    if (s <= MIN_SCALE) {
      scale.set(withSpring(MIN_SCALE));
      translateX.set(withSpring(0));
      translateY.set(withSpring(0));
      runOnJS(reportZoom)(false);
      return;
    }
    translateX.set(withSpring(clampToBounds(translateX.get(), width, s)));
    translateY.set(withSpring(clampToBounds(translateY.get(), height, s)));
    runOnJS(reportZoom)(true);
  };

  const pinch = Gesture.Pinch()
    .withTestId(`${testID}-pinch`)
    .onStart(() => {
      savedScale.set(scale.get());
      savedTranslateX.set(translateX.get());
      savedTranslateY.set(translateY.get());
      dismissY.set(withTiming(0, { duration: 100 }));
      dismissProgress.set(0);
    })
    .onUpdate((event) => {
      const next = clamp(savedScale.get() * event.scale, PINCH_MIN_SCALE, MAX_SCALE);
      scale.set(next);
      // Keep the point under the fingers fixed while scaling.
      const focalX = event.focalX - width / 2;
      const focalY = event.focalY - height / 2;
      const ratio = next / savedScale.get();
      translateX.set(focalX - (focalX - savedTranslateX.get()) * ratio);
      translateY.set(focalY - (focalY - savedTranslateY.get()) * ratio);
    })
    .onEnd(() => {
      settle();
    });

  // At rest a vertical drag dismisses; horizontal movement is left to the
  // pager underneath, which is why this gesture fails on a horizontal start.
  const dismissPan = Gesture.Pan()
    .withTestId(`${testID}-dismiss`)
    .enabled(!zoomed)
    .maxPointers(1)
    .activeOffsetY([-12, 12])
    .failOffsetX([-16, 16])
    .onChange((event) => {
      if (scale.get() > MIN_SCALE) return;
      dismissY.set(event.translationY);
      dismissProgress.set(clamp(Math.abs(event.translationY) / (height / 2), 0, 1));
    })
    .onEnd((_event, success) => {
      if (scale.get() > MIN_SCALE) return;
      if (success && Math.abs(dismissY.get()) > DISMISS_THRESHOLD) {
        runOnJS(onDismiss)();
      } else {
        dismissY.set(withSpring(0));
        dismissProgress.set(withTiming(0));
      }
    });

  // Zoomed in, a one-finger drag pans the page in any direction. Started
  // against a side edge and pulled past it, it zooms out and turns the page.
  const zoomedPan = Gesture.Pan()
    .withTestId(`${testID}-pan`)
    .enabled(zoomed)
    .maxPointers(1)
    .onStart(() => {
      savedTranslateX.set(translateX.get());
      savedTranslateY.set(translateY.get());
    })
    .onUpdate((event) => {
      if (scale.get() <= MIN_SCALE) return;
      translateX.set(savedTranslateX.get() + event.translationX);
      translateY.set(savedTranslateY.get() + event.translationY);
    })
    .onEnd((event, success) => {
      const s = scale.get();
      if (s <= MIN_SCALE) return;
      // A drag cut short, say by a second finger starting a pinch, never pages.
      const direction =
        success && edgeSwipe(savedTranslateX.get(), event.translationX, ((s - 1) * width) / 2);
      if (direction && canSwipe[direction]) {
        scale.set(withTiming(MIN_SCALE));
        translateX.set(withTiming(0));
        translateY.set(withTiming(0));
        runOnJS(reportEdgeSwipe)(direction);
        return;
      }
      settle();
    });

  const doubleTap = Gesture.Tap()
    .withTestId(`${testID}-double-tap`)
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.get() > MIN_SCALE) {
        scale.set(withTiming(MIN_SCALE));
        translateX.set(withTiming(0));
        translateY.set(withTiming(0));
        runOnJS(reportZoom)(false);
        return;
      }
      scale.set(withTiming(DOUBLE_TAP_SCALE));
      const focalX = event.x - width / 2;
      const focalY = event.y - height / 2;
      translateX.set(
        withTiming(clampToBounds(focalX * (1 - DOUBLE_TAP_SCALE), width, DOUBLE_TAP_SCALE)),
      );
      translateY.set(
        withTiming(clampToBounds(focalY * (1 - DOUBLE_TAP_SCALE), height, DOUBLE_TAP_SCALE)),
      );
      runOnJS(reportZoom)(true);
    });

  const singleTap = Gesture.Tap()
    .withTestId(`${testID}-tap`)
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onTap)();
    });

  const gesture = Gesture.Race(
    Gesture.Exclusive(doubleTap, singleTap),
    Gesture.Simultaneous(pinch, dismissPan, zoomedPan),
  );

  const pageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() + dismissY.get() },
      { scale: scale.get() * (1 - Math.min(Math.abs(dismissY.get()) / height, 0.4)) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, { width, height }, pageStyle]}>
        <DocumentImage
          source={{ uri }}
          style={styles.image}
          contentFit="contain"
          transition={120}
          accessibilityLabel={label}
          accessible
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
