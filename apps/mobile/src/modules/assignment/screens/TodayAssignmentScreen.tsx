import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useActiveAssignment } from '../hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { Skeleton } from '../../dashboard/components/SkeletonLoader';
import { useNavigation } from '@react-navigation/native';

export function TodayAssignmentScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const { data: assignment, isLoading, refetch, isRefetching } = useActiveAssignment();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Skeleton height={32} width="50%" style={{ marginBottom: 20 }} />
        <Skeleton height={140} borderRadius={12} style={{ marginBottom: 20 }} />
        <Skeleton height={50} style={{ marginBottom: 10 }} />
        <Skeleton height={50} style={{ marginBottom: 10 }} />
        <Skeleton height={50} style={{ marginBottom: 10 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[colors.primary]} />
      }
    >
      <Text style={[styles.headerTitle, { color: colors.text }]}>Today's Assignment</Text>

      {assignment ? (
        <View style={styles.content}>
          <Card style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {assignment.site?.name || 'Monitored Site'}
            </Text>
            <Text style={[styles.summarySubtitle, { color: colors.textSecondary }]}>
              Route: {assignment.patrolRoute?.name || 'Active Route'}
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              Shift Time: {assignment.shift?.startTime} - {assignment.shift?.endTime}
            </Text>
          </Card>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Assignment Directory</Text>
          
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('AssignmentDetails', { assignment })}
          >
            <Text style={[styles.menuText, { color: colors.text }]}>📄 Assignment Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('ShiftDetails', { shift: assignment.shift })}
          >
            <Text style={[styles.menuText, { color: colors.text }]}>⏰ Shift Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('PatrolRoute', { route: assignment.patrolRoute })}
          >
            <Text style={[styles.menuText, { color: colors.text }]}>🗺️ Patrol Route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('AssignedGates', { route: assignment.patrolRoute })}
          >
            <Text style={[styles.menuText, { color: colors.text }]}>🚧 Assigned Gates</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('MapPreview', { site: assignment.site, route: assignment.patrolRoute })}
          >
            <Text style={[styles.menuText, { color: colors.text }]}>📍 Map Preview</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Assignment Assigned</Text>
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
