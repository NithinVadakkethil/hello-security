import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../../app/store/auth-store';
import { useTheme } from '../../../app/hooks/useTheme';
import { isOperationalRole } from '../../../app/utils/role-helpers';
import { GuardDashboard } from './GuardDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';
import { SyncStatusWidget } from '../../../app/components/SyncStatusWidget';
import { ManagerDashboard } from '../../manager/screens/ManagerDashboard';
import { OrganizationSelectorScreen } from '../../manager/screens/OrganizationSelectorScreen';
import { useManagerStore } from '../../manager/store/manager-store';
import { useNavigation } from '@react-navigation/native';

function ManagerDashboardContainer() {
  const navigation = useNavigation<any>();
  const { activeClient, setActiveClient } = useManagerStore();
  const [showSelector, setShowSelector] = React.useState(false);

  if (!activeClient || showSelector) {
    return (
      <OrganizationSelectorScreen
        onSelectClient={() => setShowSelector(false)}
      />
    );
  }

  return (
    <ManagerDashboard
      onSwitchOrganization={() => setShowSelector(true)}
      onNavigateToScan={() => navigation.navigate('Scanner')}
      onNavigateToMonitoring={() => navigation.navigate('HistoryTab')}
      onNavigateToHistory={() => navigation.navigate('HistoryTab')}
    />
  );
}

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

  const userRole = (user as any)?.employee?.role || user.role;

  // Operational field roles (Security Guard, Cleaner, Technician, Service Engineer, Plumber, Lifeguard)
  if (isOperationalRole(userRole)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <SyncStatusWidget />
        </View>
        <GuardDashboard />
      </View>
    );
  }

  // Supervisor role maintains its dedicated workflow
  if (userRole === 'SUPERVISOR') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <SyncStatusWidget />
        </View>
        <SupervisorDashboard />
      </View>
    );
  }

  // Manager role supports multi-client monitoring & unrestricted scanning
  if (userRole === 'MANAGER') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ManagerDashboardContainer />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Role Not Supported</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Mobile dashboards are supported for Operational Roles, Supervisor, and Manager roles.
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
