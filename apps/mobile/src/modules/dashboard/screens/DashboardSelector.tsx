import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../../app/store/auth-store';
import { useTheme } from '../../../app/hooks/useTheme';
import { GuardDashboard } from './GuardDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';
import { SyncStatusWidget } from '../../../app/components/SyncStatusWidget';

export function DashboardSelector() {
  const user = useAuthStore((state) => state.user);
  const { colors } = useTheme();

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.text, { color: colors.text }]}>No session found. Please log in.</Text>
      </View>
    );
  }

  if (user.role === 'SECURITY') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <SyncStatusWidget />
        </View>
        <GuardDashboard />
      </View>
    );
  }

  if (user.role === 'SUPERVISOR') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <SyncStatusWidget />
        </View>
        <SupervisorDashboard />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Role Not Supported</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Mobile dashboards are only supported for Security and Supervisor roles.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
