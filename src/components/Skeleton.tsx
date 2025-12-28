import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, DimensionValue } from 'react-native';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

interface DocumentCardSkeletonProps {
  style?: ViewStyle;
}

export function DocumentCardSkeleton({ style }: DocumentCardSkeletonProps) {
  return (
    <View style={[styles.cardContainer, style]}>
      <Skeleton height={120} borderRadius={0} />
      <View style={styles.cardContent}>
        <Skeleton width="80%" height={16} style={styles.mb8} />
        <Skeleton width="50%" height={12} style={styles.mb8} />
        <Skeleton width="60%" height={10} />
      </View>
    </View>
  );
}

interface DocumentListSkeletonProps {
  count?: number;
}

export function DocumentListSkeleton({ count = 4 }: DocumentListSkeletonProps) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <DocumentCardSkeleton key={index} style={styles.cardHalf} />
      ))}
    </View>
  );
}

interface DocumentDetailSkeletonProps {}

export function DocumentDetailSkeleton({}: DocumentDetailSkeletonProps) {
  return (
    <View style={styles.detailContainer}>
      <Skeleton height={250} borderRadius={0} />
      <View style={styles.detailContent}>
        <Skeleton width="70%" height={28} style={styles.mb16} />
        <View style={styles.row}>
          <Skeleton width={100} height={32} borderRadius={16} />
          <Skeleton width={60} height={16} />
        </View>
        <View style={styles.dateBox}>
          <View style={styles.dateRow}>
            <Skeleton width={60} height={14} />
            <Skeleton width={150} height={14} />
          </View>
          <View style={styles.dateRow}>
            <Skeleton width={60} height={14} />
            <Skeleton width={150} height={14} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e9ecef',
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 12,
  },
  cardHalf: {
    width: '48%',
    marginBottom: 12,
  },
  listContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 12,
  },
  detailContainer: {
    flex: 1,
  },
  detailContent: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mb8: {
    marginBottom: 8,
  },
  mb16: {
    marginBottom: 16,
  },
});

export default Skeleton;
