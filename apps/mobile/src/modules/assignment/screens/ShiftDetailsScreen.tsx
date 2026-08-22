import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { Card } from '../../dashboard/components/WidgetCard';

export function ShiftDetailsScreen({ route }: any) {
  const { colors } = useTheme();
  const { shift } = route.params;

  if (!shift) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Text style={{ color: colors.text }}>No shift details available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.title, { color: colors.text }]}>Shift Details</Text>

      <Card style={styles.card}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Shift Profile</Text>
        <Text style={[styles.value, { color: colors.text }]}>{shift.name}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Start Time</Text>
        <Text style={[styles.value, { color: colors.text }]}>{shift.startTime}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>End Time</Text>
        <Text style={[styles.value, { color: colors.text }]}>{shift.endTime}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Operational Status</Text>
        <Text style={[styles.value, { color: shift.isActive ? colors.success : colors.textSecondary }]}>
          {shift.isActive ? 'Active Shift Profile' : 'Inactive'}
        </Text>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Shift Protocols & Instructions</Text>
      <Card style={styles.card}>
        <Text style={[styles.instructionTitle, { color: colors.text }]}>1. Shift Punctuality</Text>
        <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
          Officers are expected to report for duty 15 minutes prior to shift start time to conduct a hand-over briefing.
        </Text>

        <View style={styles.spacer} />

        <Text style={[styles.instructionTitle, { color: colors.text }]}>2. Required Uniform</Text>
        <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
          Wear full clean security uniform, display ID badges clearly, and carry required patrol gear (flashlight, radio).
        </Text>

        <View style={styles.spacer} />

        <Text style={[styles.instructionTitle, { color: colors.text }]}>3. Patrol Frequency</Text>
        <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
          Ensure checkpoint sweeps are performed as scheduled. Keep the Hello Orbit application open for real-time check-ins.
        </Text>
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
  instructionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 12,
    lineHeight: 16,
  },
  spacer: {
    height: 14,
  },
});
