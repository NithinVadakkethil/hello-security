import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  Building,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { AppTabParamList } from '../../../app/navigation/types';
import { useAuthStore } from '../../../app/store/auth-store';
import { useIncidents } from '../../incident/hooks/useIncident';
import { dashboardApi } from '../api/dashboard.api';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { Card, StatCard } from '../components/WidgetCard';
import {
  useDashboardStats,
  useEmployees,
  useMyAssignments,
  usePatrolHistory,
  useSites,
} from '../hooks/useDashboard';

type NavigationProp = StackNavigationProp<AppTabParamList>;
type ReviewFilter = 'all' | 'pending' | 'today' | 'yesterday' | 'completed';

export function SupervisorDashboard() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore(state => state.user);

  const [activeTab, setActiveTab] = useState<'MONITORING' | 'MY_ASSIGNMENTS'>(
    'MONITORING',
  );
  const [assignmentFilter, setAssignmentFilter] = useState<
    'ACTIVE' | 'UPCOMING' | 'COMPLETED'
  >('ACTIVE');

  // Patrol Reviews Filter & Infinite Scroll State
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [reviews, setReviews] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const isFetchingNextPageRef = useRef(false);

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

  // Fetch Patrol Reviews from API with filter and pagination
  const fetchReviews = useCallback(
    async (
      targetFilter: ReviewFilter,
      targetPage: number,
      append: boolean = false,
    ) => {
      try {
        if (!append) {
          setIsLoadingReviews(true);
        } else {
          setIsFetchingMore(true);
        }
        setReviewsError(null);

        const res = await dashboardApi.getPatrolReviews({
          filter: targetFilter,
          page: targetPage,
          limit: 10,
        });

        const newItems = res.items || [];
        setTotalPages(res.totalPages || 1);
        setPage(targetPage);

        setReviews(prev => {
          if (!append) return newItems;
          const existingIds = new Set(prev.map((item: any) => item.id));
          const filteredNew = newItems.filter(
            (item: any) => !existingIds.has(item.id),
          );
          return [...prev, ...filteredNew];
        });
      } catch (err: any) {
        console.warn('Failed to fetch patrol reviews:', err);
        setReviewsError('Failed to load patrol reviews. Tap to retry.');
      } finally {
        setIsLoadingReviews(false);
        setIsFetchingMore(false);
        isFetchingNextPageRef.current = false;
      }
    },
    [],
  );

  // Trigger fetch when reviewFilter changes
  useEffect(() => {
    setPage(1);
    setReviews([]);
    fetchReviews(reviewFilter, 1, false);
  }, [reviewFilter, fetchReviews]);

  // Infinite Scroll Handler (Triggered on Scroll)
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 180;

    if (
      isCloseToBottom &&
      !isFetchingNextPageRef.current &&
      !isFetchingMore &&
      !isLoadingReviews &&
      page < totalPages
    ) {
      isFetchingNextPageRef.current = true;
      const nextPage = page + 1;
      fetchReviews(reviewFilter, nextPage, true);
    }
  };

  const onRefresh = () => {
    refetchStats();
    refetchHistory();
    refetchSites();
    refetchEmployees();
    refetchIncidents();
    refetchAssignments();
    fetchReviews(reviewFilter, 1, false);
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

  const activePatrolsList =
    history?.filter((p: any) => p.status === 'IN_PROGRESS') || [];

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
      return !item.isActive || (toDate && toDate < now);
    }
  });

  const emptyStateMessages: Record<
    ReviewFilter,
    { title: string; subtitle: string }
  > = {
    all: {
      title: 'No Patrol Reviews Available',
      subtitle: 'There are no historical or live patrol session records found.',
    },
    pending: {
      title: 'No Pending Patrol Reviews',
      subtitle:
        'All patrol sessions have been reviewed and verified by supervisors.',
    },
    today: {
      title: 'No Patrol Reviews Today',
      subtitle: 'There are no patrol sessions recorded for today yet.',
    },
    yesterday: {
      title: 'No Patrol Reviews Yesterday',
      subtitle: 'No patrol session records were logged for yesterday.',
    },
    completed: {
      title: 'No Verified Patrol Reviews',
      subtitle: 'No historical reviewed/verified patrol records found.',
    },
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.welcome, { color: colors.textSecondary }]}>
          Welcome back,
        </Text>
        <Text style={[styles.name, { color: colors.text }]}>
          {user?.email.split('@')[0]}
        </Text>
      </View>

      {/* Mode Selector Tabs */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[
            styles.modeTab,
            activeTab === 'MONITORING' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setActiveTab('MONITORING')}
        >
          <ShieldCheck
            size={16}
            color={activeTab === 'MONITORING' ? '#fff' : colors.textSecondary}
          />
          <Text
            style={[
              styles.modeTabText,
              {
                color:
                  activeTab === 'MONITORING' ? '#fff' : colors.textSecondary,
              },
            ]}
          >
            Guard Monitoring
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeTab,
            activeTab === 'MY_ASSIGNMENTS' && {
              backgroundColor: colors.primary,
            },
          ]}
          onPress={() => setActiveTab('MY_ASSIGNMENTS')}
        >
          <ClipboardList
            size={16}
            color={
              activeTab === 'MY_ASSIGNMENTS' ? '#fff' : colors.textSecondary
            }
          />
          <Text
            style={[
              styles.modeTabText,
              {
                color:
                  activeTab === 'MY_ASSIGNMENTS'
                    ? '#fff'
                    : colors.textSecondary,
              },
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
            <StatCard
              value={stats?.activePatrols || 0}
              label="Active Patrols"
              badge="Live"
              badgeColor={colors.success}
            />
            <StatCard
              value={incidents?.length || 0}
              label="Open Incidents"
              badge="Alert"
              badgeColor={colors.danger}
            />
          </View>

          <View style={styles.statsGrid}>
            <StatCard value={stats?.sites || 0} label="Sites Monitored" />
            <StatCard value={stats?.employees || 0} label="Guards Assigned" />
          </View>

          {/* Active Guard Patrols */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Active Guard Patrols
          </Text>
          {activePatrolsList.length > 0 ? (
            activePatrolsList.map((patrol: any) => (
              <TouchableOpacity
                key={patrol.id}
                onPress={() =>
                  navigation.navigate('PatrolDetails', { patrolId: patrol.id })
                }
                activeOpacity={0.7}
              >
                <Card style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: colors.success },
                      ]}
                    />
                    <Text style={[styles.guardName, { color: colors.text }]}>
                      {patrol.assignment?.employee?.firstName}{' '}
                      {patrol.assignment?.employee?.lastName}
                    </Text>
                    <ChevronRight
                      size={18}
                      color={colors.textSecondary}
                      style={{ marginLeft: 'auto' }}
                    />
                  </View>
                  <Text
                    style={[
                      styles.activityText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Route:{' '}
                    {patrol.assignment?.patrolRoute?.name || 'Patrol Route'}
                  </Text>
                  <Text
                    style={[
                      styles.activityText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Site: {patrol.assignment?.site?.name || 'Site Location'}
                  </Text>
                  <Text style={[styles.tapPrompt, { color: colors.primary }]}>
                    Tap for Checkpoint Details & Verification →
                  </Text>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No active guard patrols currently in progress
              </Text>
            </Card>
          )}

          {/* Patrol Reviews & Verification History Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Patrol Reviews & Verification
            </Text>
          </View>

          {/* Filter Chips Component */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipScroll}
          >
            {(
              [
                'all',
                'pending',
                'today',
                'yesterday',
                'completed',
              ] as ReviewFilter[]
            ).map(fKey => {
              const isActive = reviewFilter === fKey;
              const label =
                fKey === 'all'
                  ? 'All'
                  : fKey === 'pending'
                  ? 'Pending'
                  : fKey === 'today'
                  ? 'Today'
                  : fKey === 'yesterday'
                  ? 'Yesterday'
                  : 'Completed';

              return (
                <TouchableOpacity
                  key={fKey}
                  style={[
                    styles.filterChip,
                    isActive
                      ? {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        }
                      : {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                  ]}
                  onPress={() => setReviewFilter(fKey)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isActive ? '#fff' : colors.textSecondary,
                        fontWeight: isActive ? '800' : '600',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Reviews List / Loading / Empty States */}
          {isLoadingReviews && reviews.length === 0 ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 6,
                }}
              >
                Loading patrol reviews...
              </Text>
            </View>
          ) : reviewsError ? (
            <TouchableOpacity
              style={styles.errorBox}
              onPress={() => fetchReviews(reviewFilter, 1, false)}
            >
              <RefreshCw size={20} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {reviewsError}
              </Text>
            </TouchableOpacity>
          ) : reviews.length > 0 ? (
            <View style={{ gap: 10 }}>
              {reviews.map((activity: any) => {
                const isPending =
                  !activity.verificationStatus ||
                  activity.verificationStatus === 'PENDING';
                const patrolCode =
                  activity.patrolCode ||
                  `#PS-${activity.id.slice(-6).toUpperCase()}`;

                return (
                  <TouchableOpacity
                    key={activity.id}
                    onPress={() =>
                      navigation.navigate('PatrolDetails', {
                        patrolId: activity.id,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Card
                      style={[
                        styles.activityCard,
                        isPending && {
                          borderColor: colors.warning + '60',
                          borderLeftWidth: 4,
                          borderLeftColor: colors.warning,
                        },
                      ]}
                    >
                      <View style={styles.activityHeader}>
                        <View>
                          <Text
                            style={[
                              styles.patrolCodeText,
                              { color: colors.primary },
                            ]}
                          >
                            {patrolCode}
                          </Text>
                          <Text
                            style={[styles.guardName, { color: colors.text }]}
                          >
                            {activity.assignment?.employee?.firstName}{' '}
                            {activity.assignment?.employee?.lastName}
                          </Text>
                        </View>

                        {/* Verification Status Badge */}
                        {activity.verificationStatus === 'VERIFIED' ? (
                          <View
                            style={[
                              styles.vBadge,
                              { backgroundColor: colors.success + '20' },
                            ]}
                          >
                            <CheckCircle2 size={12} color={colors.success} />
                            <Text
                              style={[
                                styles.vBadgeText,
                                { color: colors.success },
                              ]}
                            >
                              VERIFIED
                            </Text>
                          </View>
                        ) : activity.verificationStatus === 'NOT_VERIFIED' ? (
                          <View
                            style={[
                              styles.vBadge,
                              { backgroundColor: colors.danger + '20' },
                            ]}
                          >
                            <XCircle size={12} color={colors.danger} />
                            <Text
                              style={[
                                styles.vBadgeText,
                                { color: colors.danger },
                              ]}
                            >
                              NOT VERIFIED
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.vBadge,
                              { backgroundColor: colors.warning + '25' },
                            ]}
                          >
                            <Clock size={12} color={colors.warning} />
                            <Text
                              style={[
                                styles.vBadgeText,
                                { color: colors.warning },
                              ]}
                            >
                              PENDING REVIEW
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text
                        style={[
                          styles.activityText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Site:{' '}
                        <Text style={{ fontWeight: '700', color: colors.text }}>
                          {activity.assignment?.site?.name || 'Site'}
                        </Text>{' '}
                        • Route:{' '}
                        {activity.assignment?.patrolRoute?.name ||
                          'Patrol Route'}
                      </Text>

                      <View style={styles.cardFooterRow}>
                        <Text
                          style={[
                            styles.activityText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Started:{' '}
                          {new Date(activity.startedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>

                        <Text
                          style={[
                            styles.actionPromptText,
                            {
                              color: isPending
                                ? colors.warning
                                : colors.primary,
                            },
                          ]}
                        >
                          {isPending ? 'Review Patrol →' : 'View Details →'}
                        </Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}

              {/* Infinite Scroll Footer Spinner */}
              {isFetchingMore && (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    Loading more reviews...
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyTitleText, { color: colors.text }]}>
                {emptyStateMessages[reviewFilter].title}
              </Text>
              <Text
                style={[
                  styles.emptySubtitleText,
                  { color: colors.textSecondary },
                ]}
              >
                {emptyStateMessages[reviewFilter].subtitle}
              </Text>
            </Card>
          )}

          {/* Open Incidents & Observations */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Observations & Incidents
          </Text>
          {incidents && incidents.length > 0 ? (
            incidents.slice(0, 5).map((inc: any) => (
              <Card
                key={inc.id}
                style={[
                  styles.activityCard,
                  { borderLeftWidth: 4, borderLeftColor: inc.status === 'RESOLVED' ? colors.success : colors.danger },
                ]}
              >
                <View style={styles.activityHeader}>
                  <Text style={[styles.guardName, { color: colors.text }]}>
                    {inc.type}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: inc.status === 'RESOLVED' ? colors.success : colors.warning,
                      textTransform: 'uppercase',
                    }}
                  >
                    {inc.status || 'OPEN'}
                  </Text>
                </View>
                <Text
                  style={[styles.activityText, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {inc.description}
                </Text>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No observations reported
              </Text>
            </Card>
          )}
        </>
      ) : (
        /* MY ASSIGNMENTS TAB */
        <>
          {/* Assignment Filter Chips */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterBtn,
                assignmentFilter === 'ACTIVE' && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => setAssignmentFilter('ACTIVE')}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  {
                    color:
                      assignmentFilter === 'ACTIVE'
                        ? '#fff'
                        : colors.textSecondary,
                  },
                ]}
              >
                Active
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterBtn,
                assignmentFilter === 'UPCOMING' && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => setAssignmentFilter('UPCOMING')}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  {
                    color:
                      assignmentFilter === 'UPCOMING'
                        ? '#fff'
                        : colors.textSecondary,
                  },
                ]}
              >
                Upcoming
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterBtn,
                assignmentFilter === 'COMPLETED' && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => setAssignmentFilter('COMPLETED')}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  {
                    color:
                      assignmentFilter === 'COMPLETED'
                        ? '#fff'
                        : colors.textSecondary,
                  },
                ]}
              >
                Completed
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            My Guard Assignments ({filteredAssignments.length})
          </Text>

          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((asg: any) => (
              <Card key={asg.id} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <Building size={18} color={colors.primary} />
                  <Text style={[styles.siteName, { color: colors.text }]}>
                    {asg.site?.name}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: asg.isActive
                          ? colors.success + '20'
                          : colors.textSecondary + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: asg.isActive
                            ? colors.success
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {asg.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View style={styles.assignmentDetails}>
                  <Text
                    style={[styles.detailText, { color: colors.textSecondary }]}
                  >
                    Guard Assigned:{' '}
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {asg.employee?.firstName} {asg.employee?.lastName}
                    </Text>
                  </Text>
                  <Text
                    style={[styles.detailText, { color: colors.textSecondary }]}
                  >
                    Shift:{' '}
                    {asg.shift?.name
                      ? `${asg.shift.name} (${asg.shift.startTime}-${asg.shift.endTime})`
                      : 'Default Shift'}
                  </Text>
                  <Text
                    style={[styles.detailText, { color: colors.textSecondary }]}
                  >
                    Effective:{' '}
                    {new Date(asg.effectiveFrom).toLocaleDateString()}
                    {asg.effectiveTo
                      ? ` - ${new Date(asg.effectiveTo).toLocaleDateString()}`
                      : ' (Ongoing)'}
                  </Text>
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No {assignmentFilter.toLowerCase()} assignments found
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
    gap: 12,
  },
  header: {
    marginBottom: 4,
  },
  welcome: {
    fontSize: 13,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3332',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  filterChipScroll: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  activityCard: {
    padding: 14,
    gap: 6,
    borderRadius: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patrolCodeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  guardName: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activityText: {
    fontSize: 12,
  },
  tapPrompt: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  vBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  actionPromptText: {
    fontSize: 12,
    fontWeight: '800',
  },
  loaderBox: {
    padding: 24,
    alignItems: 'center',
  },
  errorBox: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitleText: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  emptySubtitleText: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3332',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  assignmentCard: {
    padding: 14,
    gap: 10,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  siteName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  assignmentDetails: {
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
});
