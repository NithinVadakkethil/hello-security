import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Shield,
  Sparkles,
  Wrench,
  Cpu,
  LifeBuoy,
  Droplet,
  Clock,
  MapPin,
  CheckCircle2,
  Play,
  RotateCcw,
} from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import { getRoleConfig } from '../../../app/utils/role-helpers';
import { useActiveAssignments } from '../../assignment/hooks/useAssignment';
import { usePatrolStore } from '../../patrol/store/patrol-store';
import { usePatrol } from '../../patrol/hooks/usePatrol';
import { Card } from '../components/WidgetCard';

export function GuardDashboard() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const navigation = useNavigation<any>();

  const {
    data: assignmentsList,
    refetch: refetchAssignments,
    isLoading: isLoadingAssignments,
    isRefetching,
  } = useActiveAssignments();

  const { activeSession, loadActiveSession } = usePatrolStore();
  const { startPatrol, resumePatrol, isStarting } = usePatrol();

  const assignments = assignmentsList || [];

  const onRefresh = async () => {
    await refetchAssignments();
    await loadActiveSession();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const empRole = (user as any)?.employee?.role || (user as any)?.role || 'SECURITY';
  const roleObj = getRoleConfig(empRole);
  const RoleIcon = roleObj.icon;
  const firstNameStr = (user as any)?.employee?.firstName || user?.email?.split('@')[0] || 'User';
  const greetingRoleName = `${roleObj.label} ${firstNameStr}`;

  const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleStartAssignment = async (asg: any) => {
    try {
      if (activeSession) {
        navigation.navigate('Dashboard', { screen: 'PatrolTab' });
        return;
      }
      await startPatrol(asg.id);
      navigation.navigate('Dashboard', { screen: 'PatrolTab' });
    } catch (err: any) {
      Alert.alert('Patrol Error', err.message || 'Failed to start patrol.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      {/* Header Greeting & Role Badge */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()},</Text>
          <Text style={[styles.name, { color: colors.text }]}>{greetingRoleName}</Text>
        </View>

        <View style={[styles.roleBadge, { backgroundColor: roleObj.color + '22', borderColor: roleObj.color }]}>
          <RoleIcon size={14} color={roleObj.color} />
          <Text style={[styles.roleText, { color: roleObj.color }]}>{roleObj.label}</Text>
        </View>
      </View>

      {/* Current Time & Shift Status Widget */}
      <Card style={[styles.statusCard, { borderColor: colors.border }]}>
        <View style={styles.statusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color={colors.primary} />
            <View>
              <Text style={[styles.statusMetaLabel, { color: colors.textSecondary }]}>Current Time</Text>
              <Text style={[styles.statusMetaVal, { color: colors.text }]}>{currentTimeStr}</Text>
            </View>
          </View>

          <View style={styles.verticalDivider} />

          <View style={{ flex: 1 }}>
            <Text style={[styles.statusMetaLabel, { color: colors.textSecondary }]}>Work Status</Text>
            <Text style={[styles.statusMetaVal, { color: activeSession ? colors.success : colors.primary }]}>
              {activeSession ? '● Patrol In Progress' : 'Ready for Sweep'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Assigned Work Header */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>My Assigned Work</Text>

      {assignments.length === 0 ? (
        <Card style={styles.emptyCard}>
          <CheckCircle2 size={36} color={colors.textSecondary} style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No assignments today</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            You currently have no active patrol routes or site checkpoint assignments for today&apos;s shift.
          </Text>
        </Card>
      ) : (
        assignments.map((asg: any) => {
          const isDirect = asg.assignmentType === 'DIRECT_CHECKPOINTS' || (!asg.patrolRoute && asg.assignmentGates);
          const totalGates = isDirect
            ? asg.assignmentGates?.length || 0
            : asg.patrolRoute?.routeGates?.length || 0;
          const siteName = asg.site?.name || 'Assigned Site';
          const title = isDirect ? 'Direct Checkpoints Sweep' : asg.patrolRoute?.name || 'Patrol Route';
          const isActiveThis = activeSession?.assignmentId === asg.id;

          return (
            <Card key={asg.id} style={[styles.workCard, { borderColor: isActiveThis ? colors.primary : colors.border }]}>
              <View style={styles.workHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.workTitle, { color: colors.text }]}>{title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MapPin size={13} color={colors.primary} />
                    <Text style={[styles.siteName, { color: colors.primary }]}>{siteName}</Text>
                  </View>
                </View>

                {/* Completed Today Badge */}
                <View style={[styles.completedBadge, { backgroundColor: colors.success + '20' }]}>
                  <CheckCircle2 size={12} color={colors.success} />
                  <Text style={[styles.completedText, { color: colors.success }]}>Completed Today</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.workMetaRow}>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Checkpoints</Text>
                  <Text style={[styles.metaVal, { color: colors.text }]}>{totalGates} Checkpoints</Text>
                </View>

                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Shift Timing</Text>
                  <Text style={[styles.metaVal, { color: colors.text }]}>
                    {asg.shift ? `${asg.shift.startTime} - ${asg.shift.endTime}` : 'Active Shift'}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 14 }}>
                {isActiveThis ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                    onPress={() => navigation.navigate('Dashboard', { screen: 'PatrolTab' })}
                  >
                    <RotateCcw size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Resume Patrol</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleStartAssignment(asg)}
                    disabled={isStarting}
                  >
                    <Play size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Start Patrol</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          );
        })
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
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusCard: {
    padding: 14,
    borderRadius: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'var(--border-color, #333)',
    marginHorizontal: 16,
  },
  statusMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusMetaVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyCard: {
    padding: 36,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  workCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  workHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  siteName: {
    fontSize: 12,
    fontWeight: '700',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  completedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  workMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
