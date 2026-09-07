import React, { useEffect, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Animated } from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
}

export function FadeInView({ children, duration = 300, delay = 0, style }: FadeInViewProps) {
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, duration, delay]);

  return <Animated.View style={[style, { opacity: fadeAnim }]}>{children}</Animated.View>;
}

interface SlideInViewProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  delay?: number;
  distance?: number;
  style?: ViewStyle;
}

export function SlideInView({
  children,
  direction = 'up',
  duration = 300,
  delay = 0,
  distance = 20,
  style,
}: SlideInViewProps) {
  const slideAnim = useState(() => new Animated.Value(distance))[0];
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim, duration, delay]);

  const getTransform = () => {
    switch (direction) {
      case 'up':
        return [{ translateY: slideAnim }];
      case 'down':
        return [{ translateY: Animated.multiply(slideAnim, -1) }];
      case 'left':
        return [{ translateX: slideAnim }];
      case 'right':
        return [{ translateX: Animated.multiply(slideAnim, -1) }];
    }
  };

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: getTransform(),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface ScaleInViewProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
}

export function ScaleInView({ children, duration = 300, delay = 0, style }: ScaleInViewProps) {
  const scaleAnim = useState(() => new Animated.Value(0.9))[0];
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, fadeAnim, duration, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface PressableScaleProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}

export function PressableScale({ children, onPress, style, disabled }: PressableScaleProps) {
  const scaleAnim = useState(() => new Animated.Value(1))[0];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
      <Animated.View
        style={{ flex: 1 }}
        // @ts-ignore - using TouchableWithoutFeedback behavior
        onTouchStart={disabled ? undefined : handlePressIn}
        onTouchEnd={disabled ? undefined : handlePressOut}
        onTouchCancel={disabled ? undefined : handlePressOut}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}
