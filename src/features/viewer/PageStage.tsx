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
import { StyleSheet } from 'react-native-unistyles';

import { t } from '@/i18n';
import { isolate } from '@/utils/bidi';
import { pageForSwipe, pageFromOffset, type SwipeDirection } from '@/utils/pager';

import { ZoomablePage } from './ZoomablePage';

export interface PageStageProps {
  /** Decrypted page images, main file first. */
  pages: string[];
  title: string;
  /** The page on screen; changing it scrolls there. */
  index: number;
  onIndexChange: (index: number) => void;
  onZoomChange?: (zoomed: boolean) => void;
  /** A tap on the page: the viewer shows or hides its chrome. */
  onTap: () => void;
  /** A downward drag at rest scale. */
  onDismiss: () => void;
}

/**
 * The viewer's page area: a horizontal pager of zoomable pages on the dark
 * stage, which stays dark in both themes so paper reads true.
 */
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

  // An index set from outside (the page strip) scrolls the pager there.
  useEffect(() => {
    if (shown.current === index || index >= pages.length) return;
    shown.current = index;
    // Reduced motion jumps to the page instead of sliding there.
    list.current?.scrollToIndex({ index, animated: !reduceMotion });
  }, [index, pages.length, reduceMotion]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      // Offsets are measured from the left edge; in a right-to-left layout the
      // first page sits at the right end, so the index counts from there.
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

  // A zoomed page dragged past its edge has zoomed itself out; turn the page.
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

  const fadeStyle = useAnimatedStyle(() => ({ opacity: 1 - dismissProgress.get() * 0.7 }));

  return (
    <Animated.View style={[styles.stage, fadeStyle]}>
      <FlatList
        ref={list}
        data={pages}
        testID="page-stage-pager"
        horizontal
        pagingEnabled
        // A zoomed page pans instead of paging; it turns the page itself when
        // dragged past its edge.
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

const styles = StyleSheet.create((theme) => ({
  stage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.viewerStage,
  },
}));
