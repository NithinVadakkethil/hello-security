import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../app/hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();

  const getStyles = () => {
    let backgroundColor = colors.primary;
    let borderColor = 'transparent';
    let textColor = '#ffffff';

    if (variant === 'secondary') {
      backgroundColor = colors.surface;
      borderColor = colors.border;
      textColor = colors.text;
    } else if (variant === 'danger') {
      backgroundColor = colors.danger;
      textColor = '#ffffff';
    } else if (variant === 'outline') {
      backgroundColor = 'transparent';
      borderColor = colors.primary;
      textColor = colors.primary;
    }

    return { backgroundColor, borderColor, textColor };
  };

  const { backgroundColor, borderColor, textColor } = getStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor, borderColor, borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
});
