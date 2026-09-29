import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VerificationState } from '../hooks/useFaceVerification';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, UserCheck } from 'lucide-react-native';

interface VerificationStatusProps {
  state: VerificationState;
  message: string;
}

export const VerificationStatus: React.FC<VerificationStatusProps> = ({ state, message }) => {
  const getBadgeStyle = () => {
    switch (state) {
      case 'MATCH':
      case 'LIVENESS_PASSED':
        return { bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e', text: '#22c55e', icon: CheckCircle2 };
      case 'NO_MATCH':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#ef4444', icon: XCircle };
      case 'READY':
        return { bg: 'rgba(37, 99, 235, 0.2)', border: '#2563eb', text: '#3b82f6', icon: UserCheck };
      case 'LIVENESS_REQUIRED':
        return { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', text: '#f59e0b', icon: RefreshCw };
      default:
        return { bg: 'rgba(100, 116, 139, 0.2)', border: '#64748b', text: '#cbd5e1', icon: AlertCircle };
    }
  };

  const styleConfig = getBadgeStyle();
  const IconComponent = styleConfig.icon;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: styleConfig.bg,
          borderColor: styleConfig.border,
        },
      ]}
    >
      <IconComponent size={20} color={styleConfig.text} />
      <Text style={[styles.text, { color: styleConfig.text }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    gap: 10,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
