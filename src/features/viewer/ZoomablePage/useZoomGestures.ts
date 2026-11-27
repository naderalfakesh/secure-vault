import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { edgeSwipe } from '@/utils/pager';

import {
  DISMISS_ACTIVE_OFFSET_Y,
  DISMISS_FAIL_OFFSET_X,
  DISMISS_MAX_SHRINK,
  DISMISS_THRESHOLD,
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  PINCH_MIN_SCALE,
  PINCH_RESET_MS,
} from './constants';
import { clampToBounds, doubleTapTranslation, pinchTranslation } from './helpers';
import type { UseZoomGesturesOptions } from './types';

export function useZoomGestures({
  testID,
  zoomed,
  reportZoom,
  reportEdgeSwipe,
  onDismiss,
  onTap,
  dismissProgress,
  canSwipe,
}: UseZoomGesturesOptions) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const dismissY = useSharedValue(0);

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
      dismissY.set(withTiming(0, { duration: PINCH_RESET_MS }));
      dismissProgress.set(0);
    })
    .onUpdate((event) => {
      const next = clamp(savedScale.get() * event.scale, PINCH_MIN_SCALE, MAX_SCALE);
      scale.set(next);
      const ratio = next / savedScale.get();
      translateX.set(pinchTranslation(event.focalX, width, savedTranslateX.get(), ratio));
      translateY.set(pinchTranslation(event.focalY, height, savedTranslateY.get(), ratio));
    })
    .onEnd(() => {
      settle();
    });

  // Fail on horizontal start so the pager underneath receives horizontal swipes at rest.
  const dismissPan = Gesture.Pan()
    .withTestId(`${testID}-dismiss`)
    .enabled(!zoomed)
    .maxPointers(1)
    .activeOffsetY([-DISMISS_ACTIVE_OFFSET_Y, DISMISS_ACTIVE_OFFSET_Y])
    .failOffsetX([-DISMISS_FAIL_OFFSET_X, DISMISS_FAIL_OFFSET_X])
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
      translateX.set(withTiming(doubleTapTranslation(event.x, width, DOUBLE_TAP_SCALE)));
      translateY.set(withTiming(doubleTapTranslation(event.y, height, DOUBLE_TAP_SCALE)));
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
      {
        scale: scale.get() * (1 - Math.min(Math.abs(dismissY.get()) / height, DISMISS_MAX_SHRINK)),
      },
    ],
  }));

  return { gesture, pageStyle, width, height };
}
