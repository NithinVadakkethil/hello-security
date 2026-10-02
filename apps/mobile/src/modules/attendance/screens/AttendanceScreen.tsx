import { useNavigation } from '@react-navigation/native';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  MapPin,
  Shield,
  User,
  WifiOff,
} from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import {
  formatPatrolDate,
  formatPatrolTime,
} from '../../../app/utils/date-formatter';
import { getEmployeeDisplayName } from '../../../app/utils/user-helpers';
import { useActiveAssignments } from '../../assignment/hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { useAttendanceStore } from '../store/attendance-store';

export function AttendanceScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore(state => state.user);
  const isConnected = useOfflineStore(state => state.isConnected);

  const {
    data: assignmentsList,
    isLoading: isLoadingAssignments,
    refetch: refetchAssignments,
    isRefetching,
  } = useActiveAssignments();

  const { todayAttendance, history, loadAttendance } = useAttendanceStore();

  const activeAssignment =
    assignmentsList && assignmentsList.length > 0 ? assignmentsList[0] : null;
  const empId = user?.employeeId || (user as any)?.employee?.id || '';
  const employeeName = getEmployeeDisplayName(user);
  const siteName = activeAssignment?.site?.name || 'Assigned Site';
  const shiftName = activeAssignment?.shift?.name || 'Standard Shift';
  const designation =
    (user as any)?.employee?.designation ||
    (user as any)?.role ||
    'Security Guard';

  const shiftStart = activeAssignment?.shift?.startTime || '09:00 AM';
  const shiftEnd = activeAssignment?.shift?.endTime || '09:00 PM';
  const shiftWindow = `${shiftStart} - ${shiftEnd}`;

  useEffect(() => {
    if (empId && activeAssignment?.id) {
      loadAttendance(empId, activeAssignment.id);
    }
  }, [empId, activeAssignment?.id, loadAttendance]);

  const handleMarkAttendancePress = () => {
    navigation.navigate('FaceVerification', {
      mode: 'MARK_ATTENDANCE',
      assignment: activeAssignment,
    });
  };

  const handleCheckOutPress = () => {
    navigation.navigate('FaceVerification', {
      mode: 'MARK_CHECKOUT',
      assignment: activeAssignment,
    });
  };

  const onRefresh = async () => {
    await refetchAssignments();
    if (empId && activeAssignment?.id) {
      loadAttendance(empId, activeAssignment.id);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Today's Attendance
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {/* Offline Banner if disconnected */}
        {!isConnected && (
          <View
            style={[
              styles.offlineBanner,
              { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
            ]}
          >
            <WifiOff size={18} color="#D97706" style={{ marginRight: 8 }} />
            <Text style={styles.offlineText}>
              Working Offline. Face verification will capture attendance locally
              as Pending Sync.
            </Text>
          </View>
        )}

        {/* Employee & Assignment Info Card */}
        <Card style={[styles.infoCard, { borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.primary + '20' },
              ]}
            >
              <User size={24} color={colors.primary} />
            </View>
            <View style={styles.infoMeta}>
              <Text style={[styles.empName, { color: colors.text }]}>
                {employeeName}
              </Text>
              <Text style={[styles.empRole, { color: colors.textSecondary }]}>
                {designation}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.detailRow}>
            <MapPin
              size={16}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Site:
            </Text>
            <Text
              style={[styles.detailValue, { color: colors.text }]}
              numberOfLines={1}
            >
              {siteName}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Clock
              size={16}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Assigned Shift:
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {shiftWindow} ({shiftName})
            </Text>
          </View>
        </Card>

        {/* Main Attendance Card */}
        <Card style={[styles.statusCard, { borderColor: colors.border }]}>
          <Text
            style={[styles.cardSectionTitle, { color: colors.textSecondary }]}
          >
            TODAY'S STATUS
          </Text>

          {isLoadingAssignments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={[styles.loadingLabel, { color: colors.textSecondary }]}
              >
                Resolving active shift assignment...
              </Text>
            </View>
          ) : !todayAttendance ? (
            /* BEFORE ATTENDANCE STATE */
            <View style={styles.notMarkedContainer}>
              <View
                style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}
              >
                <AlertCircle
                  size={16}
                  color="#D97706"
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>
                  NOT MARKED
                </Text>
              </View>

              <Text style={[styles.promptTitle, { color: colors.text }]}>
                Attendance Not Marked
              </Text>
              <Text style={[styles.promptSub, { color: colors.textSecondary }]}>
                Attendance is required before starting your assigned shift.
              </Text>

              <TouchableOpacity
                style={[styles.primaryCta, { backgroundColor: colors.primary }]}
                onPress={handleMarkAttendancePress}
              >
                <Shield size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryCtaText}>MARK ATTENDANCE</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* AFTER SUCCESSFUL ATTENDANCE STATE */
            <View style={styles.markedContainer}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: todayAttendance.checkOutAt
                      ? '#D1FAE5'
                      : todayAttendance.status === 'PENDING_SYNC'
                      ? '#DBEAFE'
                      : '#D1FAE5',
                  },
                ]}
              >
                <CheckCircle2
                  size={16}
                  color={
                    todayAttendance.checkOutAt
                      ? '#059669'
                      : todayAttendance.status === 'PENDING_SYNC'
                      ? '#2563EB'
                      : '#059669'
                  }
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color: todayAttendance.checkOutAt
                        ? '#047857'
                        : todayAttendance.status === 'PENDING_SYNC'
                        ? '#1D4ED8'
                        : '#047857',
                    },
                  ]}
                >
                  {todayAttendance.checkOutAt
                    ? '✓ COMPLETED'
                    : todayAttendance.status === 'PENDING_SYNC'
                    ? '✓ CAPTURED (PENDING SYNC)'
                    : '✓ CHECKED IN'}
                </Text>
              </View>

              <Text style={[styles.successBannerTitle, { color: colors.text }]}>
                {todayAttendance.checkOutAt
                  ? '✓ Attendance Completed'
                  : '✓ Attendance Marked'}
              </Text>

              <View style={styles.gridContainer}>
                <View
                  style={[styles.gridCell, { backgroundColor: colors.surface }]}
                >
                  <Text
                    style={[styles.cellLabel, { color: colors.textSecondary }]}
                  >
                    Check-in Time
                  </Text>
                  <Text style={[styles.cellValue, { color: colors.text }]}>
                    {formatPatrolTime(
                      todayAttendance.checkInAt,
                      'Asia/Dubai',
                      false,
                    )}
                  </Text>
                </View>

                {todayAttendance.checkOutAt ? (
                  <View
                    style={[
                      styles.gridCell,
                      { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Check-out Time
                    </Text>
                    <Text style={[styles.cellValue, { color: colors.text }]}>
                      {formatPatrolTime(
                        todayAttendance.checkOutAt,
                        'Asia/Dubai',
                        false,
                      )}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.gridCell,
                      { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Verification
                    </Text>
                    <Text style={[styles.cellValue, { color: colors.primary }]}>
                      {todayAttendance.status === 'PENDING_SYNC'
                        ? 'Pending Sync'
                        : 'Face Verified'}
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.gridCellFull,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[styles.cellLabel, { color: colors.textSecondary }]}
                >
                  Assigned Shift
                </Text>
                <Text style={[styles.cellValue, { color: colors.text }]}>
                  {todayAttendance.shiftStartTime &&
                  todayAttendance.shiftEndTime
                    ? `${todayAttendance.shiftStartTime} - ${todayAttendance.shiftEndTime}`
                    : shiftWindow}
                </Text>
              </View>

              {/* Check Out CTA or Checked Out Disabled Status */}
              {!todayAttendance.checkOutAt ? (
                <TouchableOpacity
                  style={[
                    styles.primaryCta,
                    { backgroundColor: '#DC2626', marginTop: 16 },
                  ]}
                  onPress={handleCheckOutPress}
                >
                  <LogOut
                    size={20}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryCtaText}>CHECK OUT</Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.primaryCta,
                    {
                      backgroundColor: colors.border + '60',
                      marginTop: 16,
                    },
                  ]}
                >
                  <CheckCircle2
                    size={20}
                    color={colors.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.primaryCtaText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    CHECKED OUT
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* History Section */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
              Recent Attendance
            </Text>
            {history.map(rec => (
              <Card
                key={rec.id}
                style={[styles.historyCard, { borderColor: colors.border }]}
              >
                <View style={styles.historyHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar
                      size={16}
                      color={colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.historyDate, { color: colors.text }]}>
                      {formatPatrolDate(rec.checkInAt, 'Asia/Dubai')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.historyBadge,
                      {
                        backgroundColor:
                          rec.status === 'COMPLETED'
                            ? '#D1FAE5'
                            : rec.status === 'PENDING_SYNC'
                            ? '#DBEAFE'
                            : '#D1FAE5',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.historyBadgeText,
                        {
                          color:
                            rec.status === 'COMPLETED'
                              ? '#047857'
                              : rec.status === 'PENDING_SYNC'
                              ? '#1D4ED8'
                              : '#047857',
                        },
                      ]}
                    >
                      {rec.status === 'COMPLETED'
                        ? 'Completed'
                        : rec.status === 'PENDING_SYNC'
                        ? 'Pending Sync'
                        : 'Present'}
                    </Text>
                  </View>
                </View>

                <View style={styles.historyMeta}>
                  <Text
                    style={[
                      styles.historyMetaText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Check-in:{' '}
                    {formatPatrolTime(rec.checkInAt, 'Asia/Dubai', false)}
                    {rec.checkOutAt
                      ? `  •  Check-out: ${formatPatrolTime(
                          rec.checkOutAt,
                          'Asia/Dubai',
                          false,
                        )}`
                      : ''}
                  </Text>
                  <Text
                    style={[
                      styles.historyMetaText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {rec.siteName || siteName}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  offlineText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoMeta: {
    flex: 1,
  },
  empName: {
    fontSize: 17,
    fontWeight: '700',
  },
  empRole: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  detailLabel: {
    fontSize: 13,
    width: 95,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadingLabel: {
    marginTop: 8,
    fontSize: 13,
  },
  notMarkedContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  promptSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryCta: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  markedContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  successBannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
    color: '#10B981',
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  gridCell: {
    flex: 0.48,
    padding: 12,
    borderRadius: 10,
  },
  gridCellFull: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
  },
  cellLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  cellValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 8,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  historyCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyMetaText: {
    fontSize: 12,
  },
});
