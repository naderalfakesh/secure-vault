import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { t } from '@/i18n';
import { isolate } from '@/utils/bidi';
import { pageForSwipe, pageFromOffset, type SwipeDirection } from '@/utils/pager';

import { ZoomablePage } from '../ZoomablePage';
import { DISMISS_FADE } from './constants';
import { styles } from './PageStage.styles';

export interface PageStageProps {
  pages: string[];
  title: string;
  index: number;
  onIndexChange: (index: number) => void;
  onZoomChange?: (zoomed: boolean) => void;
  onTap: () => void;
  onDismiss: () => void;
}

export function PageStage({
  pages,
  title,
  index,
  onIndexChange,
  onZoomChange,
  onTap,
  onDismiss,
}: PageStageProps) {
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<string>>(null);
  const shown = useRef(index);
  const [zoomed, setZoomed] = useState(false);
  const dismissProgress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (shown.current === index || index >= pages.length) return;
    shown.current = index;
    list.current?.scrollToIndex({ index, animated: !reduceMotion });
  }, [index, pages.length, reduceMotion]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const next = pageFromOffset({
        offsetX: contentOffset.x,
        pageWidth: layoutMeasurement.width || width,
        contentWidth: contentSize.width,
        pageCount: pages.length,
      });
      if (next === shown.current) return;
      shown.current = next;
      onIndexChange(next);
    },
    [width, pages.length, onIndexChange],
  );

  const onZoom = useCallback(
    (value: boolean) => {
      setZoomed(value);
      onZoomChange?.(value);
    },
    [onZoomChange],
  );

  const onEdgeSwipe = useCallback(
    (from: number, direction: SwipeDirection) => {
      const next = pageForSwipe(from, direction, pages.length);
      if (next === null) return;
      shown.current = next;
      onIndexChange(next);
      list.current?.scrollToIndex({ index: next, animated: !reduceMotion });
    },
    [pages.length, onIndexChange, reduceMotion],
  );

  const fadeStyle = useAnimatedStyle(() => ({ opacity: 1 - dismissProgress.get() * DISMISS_FADE }));

  return (
    <Animated.View style={[styles.stage, fadeStyle]}>
      <FlatList
        ref={list}
        data={pages}
        testID="page-stage-pager"
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index < pages.length ? index : 0}
        keyExtractor={(uri) => uri}
        getItemLayout={(_data, itemIndex) => ({
          length: width,
          offset: width * itemIndex,
          index: itemIndex,
        })}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item, index: itemIndex }) => (
          <ZoomablePage
            uri={item}
            label={t('viewer.pageLabel', {
              number: itemIndex + 1,
              count: pages.length,
              title: isolate(title),
            })}
            onZoomChange={onZoom}
            onDismiss={onDismiss}
            onTap={onTap}
            dismissProgress={dismissProgress}
            canSwipe={{
              left: pageForSwipe(itemIndex, 'left', pages.length) !== null,
              right: pageForSwipe(itemIndex, 'right', pages.length) !== null,
            }}
            onEdgeSwipe={(direction) => onEdgeSwipe(itemIndex, direction)}
            testID={`page-stage-page-${itemIndex}`}
          />
        )}
      />
    </Animated.View>
  );
}
