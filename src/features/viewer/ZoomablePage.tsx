import { Image } from 'expo-image';
import { useEffect } from 'react';
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
}

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
}: ZoomablePageProps) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const dismissY = useSharedValue(0);

  useEffect(() => {
    // A new page starts at rest.
    scale.set(MIN_SCALE);
    translateX.set(0);
    translateY.set(0);
    dismissY.set(0);
  }, [uri, scale, translateX, translateY, dismissY]);

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
      runOnJS(onZoomChange)(false);
      return;
    }
    translateX.set(withSpring(clampToBounds(translateX.get(), width, s)));
    translateY.set(withSpring(clampToBounds(translateY.get(), height, s)));
    runOnJS(onZoomChange)(true);
  };

  const pinch = Gesture.Pinch()
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

  // Zoomed in, a one-finger drag pans the page in any direction.
  const zoomedPan = Gesture.Pan()
    .maxPointers(1)
    .onChange((event) => {
      if (scale.get() <= MIN_SCALE) return;
      translateX.set(translateX.get() + event.changeX);
      translateY.set(translateY.get() + event.changeY);
    })
    .onEnd(() => {
      if (scale.get() > MIN_SCALE) settle();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.get() > MIN_SCALE) {
        scale.set(withTiming(MIN_SCALE));
        translateX.set(withTiming(0));
        translateY.set(withTiming(0));
        runOnJS(onZoomChange)(false);
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
      runOnJS(onZoomChange)(true);
    });

  const singleTap = Gesture.Tap()
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
        <Image
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
