import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTheme } from '../app/hooks/useTheme';

interface LoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loader({ message = 'Loading...', fullScreen = false }: LoaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        fullScreen && { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.background, zIndex: 999 },
      ]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={[styles.text, { color: colors.textSecondary }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
});
