import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { Card } from '../../dashboard/components/WidgetCard';

export function MapPreviewScreen({ route }: any) {
  const { colors } = useTheme();
  const { site, route: patrolRoute } = route.params;

  if (!site) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Text style={{ color: colors.text }}>No site details available for map preview.</Text>
      </View>
    );
  }

  const routeGates = patrolRoute?.routeGates || [];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.title, { color: colors.text }]}>Map Preview</Text>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Schematic Site Map</Text>
      <Card style={[styles.mapContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.gridBorder, { borderColor: colors.border }]}>
          <View style={[styles.siteCenterMarker, { backgroundColor: colors.primary }]}>
            <Text style={styles.markerText}>HQ</Text>
          </View>

          {routeGates.map((rg: any, idx: number) => {
            const angle = (idx * 2 * Math.PI) / Math.max(routeGates.length, 1);
            const radius = 60;
            const topOffset = 80 + Math.sin(angle) * radius;
            const leftOffset = 120 + Math.cos(angle) * radius;

            return (
              <View
                key={rg.id}
                style={[
                  styles.gateMarker,
                  {
                    backgroundColor: colors.success,
                    top: topOffset,
                    left: leftOffset,
                  },
                ]}
              >
                <Text style={styles.markerText}>G{rg.sequence}</Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          HQ represents Site Center. G1 - G{routeGates.length} represent gate check-points.
        </Text>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Coordinates Checklist</Text>
      <Card style={styles.card}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Site Coordinates</Text>
        <Text style={[styles.coordinateText, { color: colors.text }]}>
          Lat: {site.latitude || '34.0522'} / Long: {site.longitude || '-118.2437'}
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {routeGates.map((rg: any) => (
          <View key={rg.id} style={styles.gateCoordRow}>
            <Text style={[styles.gateName, { color: colors.text }]}>
              Gate {rg.sequence}: {rg.gate?.name}
            </Text>
            <Text style={[styles.coordinateText, { color: colors.textSecondary }]}>
              Lat: {rg.gate?.latitude || '34.0525'} / Long: {rg.gate?.longitude || '-118.2435'}
            </Text>
          </View>
        ))}
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
  mapContainer: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  gridBorder: {
    width: 280,
    height: 180,
    borderWidth: 1,
    borderRadius: 8,
    position: 'relative',
  },
  siteCenterMarker: {
    position: 'absolute',
    top: 80,
    left: 120,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  gateMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  markerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  hint: {
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
  },
  card: {
    padding: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  coordinateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  gateCoordRow: {
    marginBottom: 10,
  },
  gateName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
});
