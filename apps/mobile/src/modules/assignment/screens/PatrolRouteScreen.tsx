import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { Card } from '../../dashboard/components/WidgetCard';

export function PatrolRouteScreen({ route }: any) {
  const { colors } = useTheme();
  const { route: patrolRoute } = route.params;

  if (!patrolRoute) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Text style={{ color: colors.text }}>No route details available.</Text>
      </View>
    );
  }

  const gatesCount = patrolRoute.routeGates?.length || 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.title, { color: colors.text }]}>Patrol Route</Text>

      <Card style={styles.card}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Route Name</Text>
        <Text style={[styles.value, { color: colors.text }]}>{patrolRoute.name}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Route Code</Text>
        <Text style={[styles.value, { color: colors.text }]}>{patrolRoute.routeCode}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Assigned Gates</Text>
        <Text style={[styles.value, { color: colors.text }]}>{gatesCount} Checkpoints</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
        <Text style={[styles.value, { color: patrolRoute.isActive ? colors.success : colors.textSecondary }]}>
          {patrolRoute.isActive ? 'Active Route' : 'Inactive'}
        </Text>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Route Compliance Rules</Text>
      <Card style={styles.card}>
        <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
          ⚠️ Ensure all gates on this route are scanned in order of sequence. Skipping a gate will invalidate the patrol session report.
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
  instructionText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
