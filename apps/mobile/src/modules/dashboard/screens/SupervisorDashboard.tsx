import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppTabParamList } from '../../../app/navigation/types';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import {
  useDashboardStats,
  usePatrolHistory,
  useSites,
  useEmployees,
  useMyAssignments,
} from '../hooks/useDashboard';
import { useIncidents } from '../../incident/hooks/useIncident';
import { Card, StatCard } from '../components/WidgetCard';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  ClipboardList,
  Building,
  UserCheck,
} from 'lucide-react-native';

type NavigationProp = StackNavigationProp<AppTabParamList>;

export function SupervisorDashboard() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState<'MONITORING' | 'MY_ASSIGNMENTS'>('MONITORING');
  const [assignmentFilter, setAssignmentFilter] = useState<'ACTIVE' | 'UPCOMING' | 'COMPLETED'>('ACTIVE');

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

  const {
    data: myAssignments,
    isLoading: isAssignmentsLoading,
    refetch: refetchAssignments,
    isRefetching: isAssignmentsRefetching,
  } = useMyAssignments();

  const onRefresh = () => {
    refetchStats();
    refetchHistory();
    refetchSites();
    refetchEmployees();
    refetchIncidents();
    refetchAssignments();
  };

  const isLoading =
    isStatsLoading ||
    isHistoryLoading ||
    isSitesLoading ||
    isEmployeesLoading ||
    isIncidentsLoading ||
    isAssignmentsLoading;

  const isRefreshing =
    isStatsRefetching ||
    isHistoryRefetching ||
    isSitesRefetching ||
    isEmployeesRefetching ||
    isIncidentsRefetching ||
    isAssignmentsRefetching;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const activePatrolsList = history?.filter((p) => p.status === 'IN_PROGRESS') || [];

  // Filter Supervisor's own assignments
  const now = new Date();
  const filteredAssignments = (myAssignments || []).filter((item: any) => {
    const fromDate = new Date(item.effectiveFrom);
    const toDate = item.effectiveTo ? new Date(item.effectiveTo) : null;

    if (assignmentFilter === 'ACTIVE') {
      return item.isActive && fromDate <= now && (!toDate || toDate >= now);
    } else if (assignmentFilter === 'UPCOMING') {
      return item.isActive && fromDate > now;
    } else {
      // COMPLETED
      return !item.isActive || (toDate && toDate < now);
    }
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.welcome, { color: colors.textSecondary }]}>Welcome back,</Text>
        <Text style={[styles.name, { color: colors.text }]}>
          Supervisor {user?.email.split('@')[0]}
        </Text>
      </View>

      {/* Main Mode Toggle Tabs */}
      <View style={[styles.modeToggleContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.modeTab,
            activeTab === 'MONITORING' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setActiveTab('MONITORING')}
        >
          <ShieldCheck size={16} color={activeTab === 'MONITORING' ? '#fff' : colors.textSecondary} />
          <Text
            style={[
              styles.modeTabText,
              { color: activeTab === 'MONITORING' ? '#fff' : colors.textSecondary },
            ]}
          >
            Guard Monitoring
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeTab,
            activeTab === 'MY_ASSIGNMENTS' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setActiveTab('MY_ASSIGNMENTS')}
        >
          <ClipboardList size={16} color={activeTab === 'MY_ASSIGNMENTS' ? '#fff' : colors.textSecondary} />
          <Text
            style={[
              styles.modeTabText,
              { color: activeTab === 'MY_ASSIGNMENTS' ? '#fff' : colors.textSecondary },
            ]}
          >
            My Assignments ({myAssignments?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'MONITORING' ? (
        <>
          {/* Stats Overview */}
          <View style={styles.statsGrid}>
            <StatCard value={stats?.activePatrols || 0} label="Active Patrols" badge="Live" badgeColor={colors.success} />
            <StatCard value={incidents?.length || 0} label="Open Incidents" badge="Alert" badgeColor={colors.danger} />
          </View>

          <View style={styles.statsGrid}>
            <StatCard value={stats?.sites || 0} label="Sites Monitored" />
            <StatCard value={stats?.employees || 0} label="Guards Assigned" />
          </View>

          {/* Active Guard Patrols */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Guard Patrols</Text>
          {activePatrolsList.length > 0 ? (
            activePatrolsList.map((patrol: any) => (
              <TouchableOpacity
                key={patrol.id}
                onPress={() => navigation.navigate('PatrolDetails', { patrolId: patrol.id })}
                activeOpacity={0.7}
              >
                <Card style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.guardName, { color: colors.text }]}>
                      {patrol.assignment?.employee?.firstName} {patrol.assignment?.employee?.lastName}
                    </Text>
                    <ChevronRight size={18} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
                  </View>
                  <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                    Route: {patrol.assignment?.patrolRoute?.name || 'Patrol Route'}
                  </Text>
                  <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                    Site: {patrol.assignment?.site?.name || 'Site Location'}
                  </Text>
                  <Text style={[styles.tapPrompt, { color: colors.primary }]}>Tap for Checkpoint Details & Verification →</Text>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active guard patrols currently in progress</Text>
            </Card>
          )}

          {/* All Patrol Activity & Verification History */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Patrol Review & Verification History</Text>
          {history && history.length > 0 ? (
            history.slice(0, 8).map((activity: any) => (
              <TouchableOpacity
                key={activity.id}
                onPress={() => navigation.navigate('PatrolDetails', { patrolId: activity.id })}
                activeOpacity={0.7}
              >
                <Card style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <Text style={[styles.guardName, { color: colors.text }]}>
                      {activity.assignment?.employee?.firstName} {activity.assignment?.employee?.lastName}
                    </Text>
                    
                    {/* Verification Status Pill */}
                    {activity.verificationStatus === 'VERIFIED' ? (
                      <View style={[styles.vBadge, { backgroundColor: colors.success + '20' }]}>
                        <CheckCircle2 size={12} color={colors.success} />
                        <Text style={[styles.vBadgeText, { color: colors.success }]}>VERIFIED</Text>
                      </View>
                    ) : activity.verificationStatus === 'NOT_VERIFIED' ? (
                      <View style={[styles.vBadge, { backgroundColor: colors.danger + '20' }]}>
                        <XCircle size={12} color={colors.danger} />
                        <Text style={[styles.vBadgeText, { color: colors.danger }]}>NOT VERIFIED</Text>
                      </View>
                    ) : (
                      <View style={[styles.vBadge, { backgroundColor: colors.warning + '20' }]}>
                        <Clock size={12} color={colors.warning} />
                        <Text style={[styles.vBadgeText, { color: colors.warning }]}>PENDING</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                    Status: <Text style={{ fontWeight: '600', color: colors.text }}>{activity.status}</Text> — Route: {activity.assignment?.patrolRoute?.name || 'Custom Route'}
                  </Text>
                  <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                    Site: {activity.assignment?.site?.name} • Started: {new Date(activity.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No patrol history logged</Text>
            </Card>
          )}

          {/* Open Incidents */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Incidents</Text>
          {incidents && incidents.length > 0 ? (
            incidents.slice(0, 3).map((inc: any) => (
              <Card key={inc.id} style={[styles.activityCard, { borderLeftWidth: 4, borderLeftColor: colors.danger }]}>
                <View style={styles.activityHeader}>
                  <Text style={[styles.guardName, { color: colors.text }]}>
                    {inc.type} — Severity: {inc.severity}
                  </Text>
                </View>
                <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                  {inc.description}
                </Text>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No logged safety incidents reported</Text>
            </Card>
          )}
        </>
      ) : (
        /* MY ASSIGNMENTS TAB */
        <>
          <View style={styles.subFilterRow}>
            {(['ACTIVE', 'UPCOMING', 'COMPLETED'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.subFilterChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  assignmentFilter === filter && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setAssignmentFilter(filter)}
              >
                <Text
                  style={[
                    styles.subFilterText,
                    { color: colors.textSecondary },
                    assignmentFilter === filter && { color: '#fff', fontWeight: '700' },
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            My Assigned Tasks & Patrols ({filteredAssignments.length})
          </Text>

          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((assignment: any) => (
              <Card key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.activityHeader}>
                  <Building size={16} color={colors.primary} />
                  <Text style={[styles.guardName, { color: colors.text, marginLeft: 6 }]}>
                    {assignment.site?.name || 'Assigned Site'}
                  </Text>
                  <View
                    style={[
                      styles.vBadge,
                      {
                        backgroundColor: assignment.isActive ? colors.success + '20' : colors.textSecondary + '20',
                      },
                    ]}
                  >
                    <Text style={[styles.vBadgeText, { color: assignment.isActive ? colors.success : colors.textSecondary }]}>
                      {assignment.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                  Shift: <Text style={{ color: colors.text, fontWeight: '600' }}>{assignment.shift?.name} ({assignment.shift?.startTime} - {assignment.shift?.endTime})</Text>
                </Text>

                <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                  Route / Checkpoints: <Text style={{ color: colors.text }}>{assignment.patrolRoute?.name || 'Direct Checkpoints'}</Text>
                </Text>

                <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                  Effective From: <Text style={{ color: colors.text }}>{new Date(assignment.effectiveFrom).toLocaleDateString()}</Text>
                  {assignment.effectiveTo && ` To: ${new Date(assignment.effectiveTo).toLocaleDateString()}`}
                </Text>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No {assignmentFilter.toLowerCase()} assignments assigned to you by Admin
              </Text>
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  welcome: {
    fontSize: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
  },
  activityCard: {
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  assignmentCard: {
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  activityText: {
    fontSize: 12,
  },
  tapPrompt: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  vBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
    marginLeft: 'auto',
  },
  vBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
  },
  subFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  subFilterChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  subFilterText: {
    fontSize: 11,
  },
});
