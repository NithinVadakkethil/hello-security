import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { Card } from '../../dashboard/components/WidgetCard';

export function AssignedGatesScreen({ route }: any) {
  const { colors } = useTheme();
  const { route: patrolRoute } = route.params;

  if (!patrolRoute) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Text style={{ color: colors.text }}>No route details available.</Text>
      </View>
    );
  }

  const routeGates = patrolRoute.routeGates || [];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.title, { color: colors.text }]}>Assigned Gates</Text>

      {routeGates.length > 0 ? (
        routeGates.map((rg: any) => (
          <Card key={rg.id} style={styles.gateCard}>
            <View style={styles.header}>
              <View style={[styles.sequenceBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.sequenceText}>#{rg.sequence}</Text>
              </View>
              <View style={styles.details}>
                <Text style={[styles.gateName, { color: colors.text }]}>
                  {rg.gate?.name || 'Gate/Checkpoint'}
                </Text>
                <Text style={[styles.gateCode, { color: colors.textSecondary }]}>
                  Code: {rg.gate?.gateCode || 'N/A'}
                </Text>
              </View>
            </View>
            {rg.gate?.description && (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {rg.gate.description}
              </Text>
            )}
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No gates assigned to this route.
          </Text>
        </Card>
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
  },
  gateCard: {
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sequenceBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sequenceText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  details: {
    flex: 1,
  },
  gateName: {
    fontSize: 14,
    fontWeight: '700',
  },
  gateCode: {
    fontSize: 11,
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 44,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
