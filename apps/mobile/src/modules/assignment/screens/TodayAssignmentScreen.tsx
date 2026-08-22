import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useActiveAssignments } from '../hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { Skeleton } from '../../dashboard/components/SkeletonLoader';
import { useNavigation } from '@react-navigation/native';
import { GuardAssignment } from '../../dashboard/types';

export function TodayAssignmentScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const { data: assignmentsList, isLoading, refetch, isRefetching } = useActiveAssignments();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Skeleton height={32} width="50%" style={{ marginBottom: 20 }} />
        <Skeleton height={140} borderRadius={12} style={{ marginBottom: 20 }} />
        <Skeleton height={50} style={{ marginBottom: 10 }} />
        <Skeleton height={50} style={{ marginBottom: 10 }} />
      </View>
    );
  }

  const assignments: GuardAssignment[] = assignmentsList || [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[colors.primary]} />
      }
    >
      <Text style={[styles.headerTitle, { color: colors.text }]}>Today's Assignments</Text>

      {assignments.length > 0 ? (
        <View style={styles.content}>
          {assignments.map((assignment, index) => {
            const isDirect = assignment.assignmentType === 'DIRECT_CHECKPOINTS' || (!assignment.patrolRoute && assignment.assignmentGates);
            const checkpointCount = assignment.assignmentGates?.length || 0;

            return (
              <Card key={assignment.id} style={styles.summaryCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[styles.summaryTitle, { color: colors.text }]}>
                    {assignment.site?.name || 'Monitored Site'}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 4,
                      backgroundColor: isDirect ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: isDirect ? colors.primary : '#10b981',
                      }}
                    >
                      {isDirect ? '🚧 DIRECT GATES' : '🗺️ ROUTE'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.summarySubtitle, { color: colors.textSecondary }]}>
                  {isDirect
                    ? `Assigned Checkpoints: ${checkpointCount} Gate${checkpointCount === 1 ? '' : 's'}`
                    : `Route: ${assignment.patrolRoute?.name || 'Active Route'}`}
                </Text>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                  Shift Slot: {assignment.shift?.name || 'Shift'} ({assignment.shift?.startTime} - {assignment.shift?.endTime})
                </Text>

                <View style={{ marginTop: 14, gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => navigation.navigate('AssignmentDetails', { assignment })}
                  >
                    <Text style={[styles.menuText, { color: colors.text }]}>📄 Assignment Details</Text>
                  </TouchableOpacity>

                  {isDirect && assignment.assignmentGates && assignment.assignmentGates.length > 0 && (
                    <View style={{ marginTop: 4, padding: 8, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
                        DIRECT CHECKPOINTS LIST:
                      </Text>
                      {assignment.assignmentGates.map((ag) => (
                        <Text key={ag.id} style={{ fontSize: 12, color: colors.text, marginVertical: 2 }}>
                          • {ag.gate.name} ({ag.gate.gateCode})
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Assignments Found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            You have no active guard shift assignments for today. Please contact your dispatch supervisor to receive your assignment schedule.
          </Text>
        </View>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  content: {
    width: '100%',
  },
  summaryCard: {
    padding: 20,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  menuItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
