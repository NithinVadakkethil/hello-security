import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { formatPatrolDate } from '../../../app/utils/date-formatter';
import { Card } from '../../dashboard/components/WidgetCard';

export function AssignmentDetailsScreen({ route }: any) {
  const { colors } = useTheme();
  const { assignment } = route.params;

  if (!assignment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Text style={{ color: colors.text }}>No assignment details available.</Text>
      </View>
    );
  }

  const { employee, site } = assignment;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.title, { color: colors.text }]}>Assignment Details</Text>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Security Guard Info</Text>
      <Card style={styles.card}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {employee?.firstName} {employee?.lastName}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Employee ID</Text>
        <Text style={[styles.value, { color: colors.text }]}>{employee?.employeeNumber}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Designation</Text>
        <Text style={[styles.value, { color: colors.text }]}>{employee?.designation || 'Security Officer'}</Text>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Assignment Schedule</Text>
      <Card style={styles.card}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Effective From</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {formatPatrolDate(assignment.effectiveFrom)}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Effective To</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {assignment.effectiveTo ? formatPatrolDate(assignment.effectiveTo) : 'Indefinite / Ongoing'}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
        <Text style={[styles.value, { color: assignment.isActive ? colors.success : colors.textSecondary }]}>
          {assignment.isActive ? 'Active Duty' : 'Inactive'}
        </Text>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Site Location</Text>
      <Card style={styles.card}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Site Name</Text>
        <Text style={[styles.value, { color: colors.text }]}>{site?.name}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Address</Text>
        <Text style={[styles.value, { color: colors.text }]}>{site?.address || 'No address registered'}</Text>
      </Card>
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },
});
