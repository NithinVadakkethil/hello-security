import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import {
  useDashboardStats,
  usePatrolHistory,
  useSites,
  useEmployees,
} from '../hooks/useDashboard';
import { useIncidents } from '../../incident/hooks/useIncident';
import { Card, StatCard } from '../components/WidgetCard';
import { DashboardSkeleton } from '../components/SkeletonLoader';

export function SupervisorDashboard() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);

  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useDashboardStats();

  const {
    data: history,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
    isRefetching: isHistoryRefetching,
  } = usePatrolHistory();

  const {
    data: sites,
    isLoading: isSitesLoading,
    refetch: refetchSites,
    isRefetching: isSitesRefetching,
  } = useSites();

  const {
    data: employees,
    isLoading: isEmployeesLoading,
    refetch: refetchEmployees,
    isRefetching: isEmployeesRefetching,
  } = useEmployees();

  const {
    data: incidents,
    isLoading: isIncidentsLoading,
    refetch: refetchIncidents,
    isRefetching: isIncidentsRefetching,
  } = useIncidents();

  const onRefresh = () => {
    refetchStats();
    refetchHistory();
    refetchSites();
    refetchEmployees();
    refetchIncidents();
  };

  const isLoading = isStatsLoading || isHistoryLoading || isSitesLoading || isEmployeesLoading || isIncidentsLoading;
  const isRefreshing = isStatsRefetching || isHistoryRefetching || isSitesRefetching || isEmployeesRefetching || isIncidentsRefetching;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const activePatrolsList = history?.filter((p) => p.status === 'IN_PROGRESS') || [];

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
        <Text style={[styles.name, { color: colors.text }]}>Supervisor {user?.email.split('@')[0]}</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard value={stats?.activePatrols || 0} label="Active Patrols" badge="Live" badgeColor={colors.success} />
        <StatCard value={incidents?.length || 0} label="Open Incidents" badge="Alert" badgeColor={colors.danger} />
      </View>

      <View style={styles.statsGrid}>
        <StatCard value={stats?.sites || 0} label="Sites Monitored" />
        <StatCard value={stats?.employees || 0} label="Guards Assigned" />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 12 }}>
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0 }]}>Active Patrols</Text>
      </View>
      {activePatrolsList.length > 0 ? (
        activePatrolsList.map((patrol) => (
          <Card key={patrol.id} style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.guardName, { color: colors.text }]}>
                {patrol.assignment?.employee?.firstName} {patrol.assignment?.employee?.lastName}
              </Text>
            </View>
            <Text style={[styles.activityText, { color: colors.textSecondary }]}>
              Route: {patrol.assignment?.patrolRoute?.name || 'Patrol Route'}
            </Text>
            <Text style={[styles.activityText, { color: colors.textSecondary }]}>
              Site: {patrol.assignment?.site?.name || 'Site Location'}
            </Text>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active patrols right now</Text>
        </Card>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Incidents</Text>
      {incidents && incidents.length > 0 ? (
        incidents.slice(0, 3).map((inc) => (
          <Card key={inc.id} style={[styles.activityCard, { borderLeftWidth: 4, borderLeftColor: colors.danger }]}>
            <View style={styles.activityHeader}>
              <Text style={[styles.guardName, { color: colors.text }]}>
                {inc.type} — Severity: {inc.severity}
              </Text>
            </View>
            <Text style={[styles.activityText, { color: colors.textSecondary }]}>
              {inc.description}
            </Text>
            {inc.employee && (
              <Text style={[styles.activityText, { color: colors.textSecondary, fontSize: 10, marginTop: 4 }]}>
                Reported by Guard: {inc.employee.firstName} {inc.employee.lastName}
              </Text>
            )}
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No logged safety incidents reported</Text>
        </Card>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Monitored Sites</Text>
      <View style={styles.horizontalList}>
        {sites && sites.length > 0 ? (
          sites.map((site) => (
            <Card key={site.id} style={styles.listItem}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{site.name}</Text>
              <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                {site.address || 'No Address Provided'}
              </Text>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No registered sites found</Text>
          </Card>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
      {history && history.length > 0 ? (
        history.slice(0, 5).map((activity) => (
          <Card key={activity.id} style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: activity.status === 'COMPLETED' ? colors.primary : colors.border },
                ]}
              />
              <Text style={[styles.guardName, { color: colors.text }]}>
                {activity.assignment?.employee?.firstName} {activity.assignment?.employee?.lastName}
              </Text>
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                {new Date(activity.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={[styles.activityText, { color: colors.textSecondary }]}>
              Status: {activity.status} — Route: {activity.assignment?.patrolRoute?.name || 'Patrol Route'}
            </Text>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No recent activity logged</Text>
        </Card>
      )}
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
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 12,
  },
  activityCard: {
    padding: 14,
    marginBottom: 10,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  guardName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
  },
  activityText: {
    fontSize: 12,
    marginTop: 2,
  },
  horizontalList: {
    marginBottom: 4,
  },
  listItem: {
    padding: 12,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyCard: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
