import { Image } from 'expo-image';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StatusBar,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { IconButton, Text } from '@/components/ui';

import { ZoomablePage } from './ZoomablePage';

export interface PageViewerProps {
  visible: boolean;
  /** Decrypted page images, main file first. */
  pages: string[];
  title: string;
  initialIndex?: number;
  onClose: () => void;
}

const STRIP_THUMB = 44;

/**
 * Full-screen pager for a document's pages with pinch zoom on each page and
 * a thumbnail strip for multi-page documents. Chrome hides on a tap so the
 * page gets the whole screen. The body mounts fresh on every open, so its
 * state needs no resetting.
 */
export function PageViewer({ visible, onClose, ...body }: PageViewerProps) {
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      transparent
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <StatusBar barStyle="light-content" />
      {visible ? <ViewerBody {...body} onClose={onClose} /> : null}
    </Modal>
  );
}

function ViewerBody({ pages, title, initialIndex = 0, onClose }: Omit<PageViewerProps, 'visible'>) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const dismissProgress = useSharedValue(0);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex((current) => (next === current ? current : next));
    },
    [width],
  );

  const jumpTo = useCallback((next: number) => {
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }, []);

  const toggleChrome = useCallback(() => setChromeVisible((value) => !value), []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - dismissProgress.get() * 0.7,
  }));

  const multiPage = pages.length > 1;

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <FlatList
        ref={list}
        data={pages}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
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
            label={`Page ${itemIndex + 1} of ${pages.length}, ${title}`}
            onZoomChange={setZoomed}
            onDismiss={onClose}
            onTap={toggleChrome}
            dismissProgress={dismissProgress}
          />
        )}
      />

      {chromeVisible ? (
        <View style={[styles.header, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
          <IconButton
            icon="close"
            accessibilityLabel="Close viewer"
            variant="tinted"
            onPress={onClose}
          />
          <View style={styles.headerText}>
            <Text variant="headline" style={styles.light} numberOfLines={1}>
              {title}
            </Text>
            {multiPage ? (
              <Text variant="caption" style={styles.dim}>
                {index + 1} of {pages.length}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {chromeVisible && multiPage ? (
        <View style={[styles.strip, { paddingBottom: insets.bottom + 8 }]}>
          <FlatList
            data={pages}
            horizontal
            keyExtractor={(uri) => `strip-${uri}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
            renderItem={({ item, index: itemIndex }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Go to page ${itemIndex + 1}`}
                accessibilityState={{ selected: itemIndex === index }}
                onPress={() => jumpTo(itemIndex)}
                style={[styles.thumb, itemIndex === index && styles.thumbActive]}
              >
                <Image source={{ uri: item }} style={styles.thumbImage} contentFit="cover" />
              </Pressable>
            )}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  headerText: {
    flex: 1,
  },
  light: {
    color: '#FFFFFF',
  },
  dim: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: theme.spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  stripContent: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  thumb: {
    width: STRIP_THUMB,
    height: STRIP_THUMB,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  thumbActive: {
    borderColor: '#FFFFFF',
    opacity: 1,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
}));
