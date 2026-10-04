import { useNavigation } from '@react-navigation/native';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Shield,
} from 'lucide-react-native';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import { formatPatrolTime } from '../../../app/utils/date-formatter';
import { Card } from '../../dashboard/components/WidgetCard';
import { useAttendanceStore } from '../store/attendance-store';

interface AttendanceStatusWidgetProps {
  assignmentId?: string;
}

export function AttendanceStatusWidget({
  assignmentId,
}: AttendanceStatusWidgetProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore(state => state.user);

  const empId = user?.employeeId || (user as any)?.employee?.id || '';
  const { todayAttendance, loadAttendance } = useAttendanceStore();

  useEffect(() => {
    if (empId) {
      loadAttendance(empId, assignmentId || 'direct');
    }
  }, [empId, assignmentId, loadAttendance]);

  const handlePress = () => {
    navigation.navigate('Attendance', { assignmentId });
  };

  const handleMarkPress = () => {
    navigation.navigate('FaceVerification', {
      mode: 'MARK_ATTENDANCE',
    });
  };

  const isCheckedOut = Boolean(
    todayAttendance?.checkOutAt || todayAttendance?.status === 'COMPLETED'
  );
  const isPendingSync = todayAttendance?.status === 'PENDING_SYNC';

  return (
    <Card style={[styles.card, { borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Clock size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
            Today's Attendance
          </Text>
        </View>
        <ChevronRight size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.contentRow}>
        {!todayAttendance ? (
          <View style={styles.statusRow}>
            <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
              <AlertCircle
                size={14}
                color="#D97706"
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.badgeText, { color: '#B45309' }]}>
                NOT MARKED
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.markBtn, { backgroundColor: colors.primary }]}
              onPress={handleMarkPress}
            >
              <Shield size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.markBtnText}>Mark Attendance</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.statusRow}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isPendingSync
                    ? '#DBEAFE'
                    : isCheckedOut
                    ? '#D1FAE5'
                    : '#D1FAE5',
                },
              ]}
            >
              <CheckCircle2
                size={14}
                color={
                  isPendingSync
                    ? '#2563EB'
                    : '#059669'
                }
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: isPendingSync
                      ? '#1D4ED8'
                      : '#047857',
                  },
                ]}
              >
                {isPendingSync
                  ? '✓ PENDING SYNC'
                  : isCheckedOut
                  ? '✓ CHECKED OUT'
                  : '✓ CHECKED IN'}
              </Text>
            </View>

            <View style={styles.timeInfo}>
              <Text
                style={[styles.checkInLabel, { color: colors.textSecondary }]}
              >
                Check-in:{' '}
                <Text style={[styles.checkInTime, { color: colors.text }]}>
                  {formatPatrolTime(
                    todayAttendance.checkInAt,
                    'Asia/Dubai',
                    false,
                  )}
                </Text>
              </Text>
              {isCheckedOut && todayAttendance.checkOutAt ? (
                <Text
                  style={[
                    styles.checkInLabel,
                    { color: colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  Check-out:{' '}
                  <Text style={[styles.checkInTime, { color: colors.text }]}>
                    {formatPatrolTime(
                      todayAttendance.checkOutAt,
                      'Asia/Dubai',
                      false,
                    )}
                  </Text>
                </Text>
              ) : null}
              <Text style={[styles.verifiedTag, { color: colors.primary }]}>
                Face Verified
              </Text>
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  contentRow: {
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  timeInfo: {
    alignItems: 'flex-end',
  },
  checkInLabel: {
    fontSize: 12,
  },
  checkInTime: {
    fontWeight: '700',
  },
  verifiedTag: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
