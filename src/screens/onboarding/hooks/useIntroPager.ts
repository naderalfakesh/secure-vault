import { useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewInstance } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { offsetForPage, pageFromOffset } from '@/utils/pager';

export function useIntroPager(pageCount: number) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // RTL scroll views place page 0 at the right edge.
    setPage(
      pageFromOffset({
        offsetX: event.nativeEvent.contentOffset.x,
        pageWidth: width,
        contentWidth: event.nativeEvent.contentSize.width,
        pageCount,
      }),
    );
  };

  const goTo = (next: number) => {
    setPage(next);
    if (!reduceMotion)
      scrollRef.current?.scrollTo({ x: offsetForPage(next, width, pageCount), animated: true });
  };

  return { width, reduceMotion, scrollRef, page, onScroll, goTo };
}
