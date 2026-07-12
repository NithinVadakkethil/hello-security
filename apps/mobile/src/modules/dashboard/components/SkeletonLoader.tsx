import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';

interface SkeletonProps {
  style?: ViewStyle;
  width?: number | string;
  height?: number;
  borderRadius?: number;
}

export function Skeleton({ style, width = '100%', height = 20, borderRadius = 4 }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton height={40} width="60%" style={{ marginBottom: 24 }} />
      <View style={styles.grid}>
        <Skeleton height={100} width="47%" borderRadius={12} />
        <Skeleton height={100} width="47%" borderRadius={12} />
      </View>
      <Skeleton height={140} style={{ marginVertical: 16 }} borderRadius={12} />
      <Skeleton height={80} style={{ marginBottom: 12 }} borderRadius={8} />
      <Skeleton height={80} style={{ marginBottom: 12 }} borderRadius={8} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});
