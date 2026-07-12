import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import { useCurrentPatrolSession, usePatrolHistory } from '../hooks/useDashboard';
import { useIncidents } from '../../incident/hooks/useIncident';
import { Card, StatCard, QuickAction } from '../components/WidgetCard';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { useNavigation } from '@react-navigation/native';

export function GuardDashboard() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const navigation = useNavigation<any>();

  const {
    data: currentSession,
    isLoading: isSessionLoading,
    refetch: refetchSession,
    isRefetching: isSessionRefetching,
  } = useCurrentPatrolSession();

  const {
    data: history,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
    isRefetching: isHistoryRefetching,
  } = usePatrolHistory();

  const {
    data: incidents,
    isLoading: isIncidentsLoading,
    refetch: refetchIncidents,
    isRefetching: isIncidentsRefetching,
  } = useIncidents();

  const onRefresh = () => {
    refetchSession();
    refetchHistory();
    refetchIncidents();
  };

  const isLoading = isSessionLoading || isHistoryLoading || isIncidentsLoading;
  const isRefreshing = isSessionRefetching || isHistoryRefetching || isIncidentsRefetching;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const totalPatrols = history?.length || 0;
  const completedPatrols = history?.filter((s) => s.status === 'COMPLETED').length || 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.welcome, { color: colors.textSecondary }]}>Welcome back,</Text>
        <Text style={[styles.name, { color: colors.text }]}>Officer {user?.email.split('@')[0]}</Text>
      </View>

      {currentSession ? (
        <Card style={[styles.activeCard, { borderColor: colors.primary }]}>
          <View style={styles.activeHeader}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={[styles.activeLabel, { color: colors.success }]}>PATROL ACTIVE</Text>
          </View>
          <Text style={[styles.activeTitle, { color: colors.text }]}>
            {currentSession.assignment?.patrolRoute?.name || 'Assigned Route'}
          </Text>
          <Text style={[styles.activeDesc, { color: colors.textSecondary }]}>
            Site: {currentSession.assignment?.site?.name || 'Active Site'}
          </Text>
          <Text style={[styles.activeDesc, { color: colors.textSecondary }]}>
            Started At: {new Date(currentSession.startedAt).toLocaleTimeString()}
          </Text>
        </Card>
      ) : (
        <Card style={styles.emptyAssignmentCard}>
          <Text style={[styles.emptyAssignmentTitle, { color: colors.text }]}>Today's Assignment</Text>
          <Text style={[styles.emptyAssignmentText, { color: colors.textSecondary }]}>
            No patrol session currently active. Use the quick actions below to initiate your security sweep.
          </Text>
        </Card>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Statistics</Text>
      <View style={styles.statsGrid}>
        <StatCard value={totalPatrols} label="Total Patrols" badge="Today" badgeColor={colors.primary} />
        <StatCard value={completedPatrols} label="Completed" badge="Success" badgeColor={colors.success} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Incidents</Text>
      {incidents && incidents.length > 0 ? (
        incidents.slice(0, 2).map((inc) => (
          <Card key={inc.id} style={[styles.incidentCard, { borderLeftWidth: 4, borderLeftColor: colors.danger }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>{inc.type}</Text>
              <Text style={{ fontWeight: '800', fontSize: 11, color: colors.danger }}>{inc.severity}</Text>
            </View>
            <Text style={[styles.incidentText, { color: colors.textSecondary }]}>
              {inc.description}
            </Text>
          </Card>
        ))
      ) : (
        <Card style={styles.incidentCard}>
          <Text style={[styles.incidentTitle, { color: colors.textSecondary }]}>No recent incidents reported</Text>
          <Text style={[styles.incidentText, { color: colors.textSecondary }]}>
            All gates and checkpoints are clear. Reporting remains stable.
          </Text>
        </Card>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <QuickAction
        title="Initiate Guard Sweep"
        description="Scan site gates and log checkpoint status"
        onPress={() => navigation.navigate('Patrol')}
        color={colors.primary}
      />
      <QuickAction
        title="Report Incident"
        description="Log an active hazard, breach, or observation"
        onPress={() => navigation.navigate('Reports')}
        color={colors.danger}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  welcome: {
    fontSize: 14,
    fontWeight: '500',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  activeCard: {
    borderWidth: 2,
    marginBottom: 24,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  activeTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  activeDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyAssignmentCard: {
    marginBottom: 24,
    padding: 20,
  },
  emptyAssignmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyAssignmentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  incidentCard: {
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  incidentText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
