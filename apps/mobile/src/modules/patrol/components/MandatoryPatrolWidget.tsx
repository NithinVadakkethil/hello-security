import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ShieldAlert, CheckCircle2, Clock, AlertTriangle, ArrowRight, Clipboard } from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { apiClient } from '../../../app/api/api-client';
import { Card } from '../../dashboard/components/WidgetCard';

export interface MandatoryPatrolItem {
  id: string;
  sequence: number;
  scheduledAt: string;
  windowStart: string;
  windowEnd: string;
  status: 'UPCOMING' | 'DUE' | 'COMPLETED' | 'MISSED';
  completedAt?: string | null;
  patrolSessionId?: string | null;
}

export interface MandatoryScheduleData {
  hasAssignment: boolean;
  assignment?: {
    id: string;
    siteName?: string;
    shiftName?: string;
    shiftStartTime?: string;
    shiftEndTime?: string;
    routeName?: string;
  } | null;
  mandatoryPatrols: MandatoryPatrolItem[];
}

export function MandatoryPatrolWidget() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<MandatoryScheduleData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/mandatory-patrols/me');
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('[MandatoryPatrolWidget] Failed to fetch mandatory schedule:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSchedule();
    }, [fetchSchedule]),
  );

  if (loading && !data) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator size="small" color={colors.primary} />
      </Card>
    );
  }

  if (!data || !data.hasAssignment || !data.mandatoryPatrols || data.mandatoryPatrols.length === 0) {
    return null;
  }

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (item: MandatoryPatrolItem) => {
    switch (item.status) {
      case 'COMPLETED':
        return (
          <View style={[styles.badge, { backgroundColor: '#10B98122' }]}>
            <CheckCircle2 size={12} color="#10B981" style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: '#10B981' }]}>COMPLETED</Text>
          </View>
        );
      case 'DUE':
        return (
          <View style={[styles.badge, { backgroundColor: '#EF444422' }]}>
            <ShieldAlert size={12} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: '#EF4444', fontWeight: '900' }]}>PATROL DUE NOW</Text>
          </View>
        );
      case 'MISSED':
        return (
          <View style={[styles.badge, { backgroundColor: '#F59E0B22' }]}>
            <AlertTriangle size={12} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: '#F59E0B' }]}>MISSED</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, { backgroundColor: colors.border + '66' }]}>
            <Clock size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>UPCOMING</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>MANDATORY PATROL SCHEDULE</Text>

      <Card style={styles.card}>
        {/* Header Shift Info */}
        <View style={[styles.shiftHeader, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.shiftName, { color: colors.text }]}>
              {data.assignment?.shiftName || 'Current Shift'}
            </Text>
            <Text style={[styles.siteName, { color: colors.textSecondary }]}>
              {data.assignment?.siteName} • {data.assignment?.shiftStartTime} - {data.assignment?.shiftEndTime}
            </Text>
          </View>
          <View style={[styles.typePill, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.typePillText, { color: colors.primary }]}>2 Mandatory Patrols</Text>
          </View>
        </View>

        {/* Patrol Items List */}
        {data.mandatoryPatrols.map((item) => {
          const isDue = item.status === 'DUE';
          const isCompleted = item.status === 'COMPLETED';

          return (
            <View
              key={item.id}
              style={[
                styles.patrolRow,
                { borderColor: colors.border },
                isDue && { backgroundColor: '#EF44440C', borderColor: '#EF444444', borderWidth: 1, borderRadius: 8 },
              ]}
            >
              <View style={styles.leftCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.patrolTitle, { color: colors.text }]}>
                    Mandatory Patrol {item.sequence}
                  </Text>
                  {getStatusBadge(item)}
                </View>

                <Text style={[styles.windowText, { color: colors.textSecondary }]}>
                  Required: {formatTime(item.scheduledAt)} ({formatTime(item.windowStart)} - {formatTime(item.windowEnd)})
                </Text>

                {isCompleted && item.completedAt && (
                  <Text style={[styles.completedTime, { color: '#10B981' }]}>
                    Completed at {formatTime(item.completedAt)}
                  </Text>
                )}
              </View>

              {isDue && (
                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: colors.primary }]}
                  onPress={() =>
                    navigation.navigate('Dashboard', {
                      screen: 'PatrolTab',
                      params: { assignmentId: data.assignment?.id },
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Clipboard size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.startBtnText}>Start</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    padding: 16,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  shiftName: {
    fontSize: 15,
    fontWeight: '800',
  },
  siteName: {
    fontSize: 12,
    marginTop: 2,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  patrolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  leftCol: {
    flex: 1,
    paddingRight: 8,
  },
  patrolTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  windowText: {
    fontSize: 12,
    marginTop: 2,
  },
  completedTime: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
