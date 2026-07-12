import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { usePatrol } from '../hooks/usePatrol';
import { usePatrolStore } from '../store/patrol-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import { useActiveAssignment } from '../../assignment/hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { Button } from '../../../components/Button';
import { useNavigation } from '@react-navigation/native';

export function PatrolScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const isOnline = useOfflineStore((state) => state.isConnected);
  const queueLength = useOfflineStore((state) => state.queue.length);
  const { data: assignment } = useActiveAssignment();

  const {
    activeSession,
    scannedGateIds,
    elapsedSeconds,
    loadActiveSession,
    tick,
  } = usePatrolStore();

  const {
    startPatrol,
    isStarting,
    pausePatrol,
    isPausing,
    resumePatrol,
    isResuming,
    completePatrol,
    isCompleting,
    scanCheckpoint,
    isScanning,
  } = usePatrol();

  const [scanningGateId, setScanningGateId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [showScanForm, setShowScanForm] = useState(false);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  const handleStart = async () => {
    try {
      await startPatrol();
      Alert.alert('Patrol Started', 'Your active security patrol sweep has initiated.');
    } catch (err: any) {
      Alert.alert('Error starting patrol', err.message || 'Please try again.');
    }
  };

  const handlePause = async () => {
    if (!activeSession) return;
    try {
      await pausePatrol(activeSession.id);
      Alert.alert('Patrol Paused', 'Patrol timer paused.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pause.');
    }
  };

  const handleResume = async () => {
    if (!activeSession) return;
    try {
      await resumePatrol(activeSession.id);
      Alert.alert('Patrol Resumed', 'Patrol timer resumed.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resume.');
    }
  };

  const handleComplete = async () => {
    if (!activeSession) return;
    
    // Check if there are remaining gates
    const totalGates = assignment?.patrolRoute?.routeGates?.length || 0;
    const remaining = totalGates - scannedGateIds.length;
    
    const confirmAndComplete = async () => {
      try {
        await completePatrol({ id: activeSession.id, remarks: 'Completed checkpoint sweep.' });
        Alert.alert('Patrol Completed', 'Patrol sweep finalized and logged.');
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to complete.');
      }
    };

    if (remaining > 0) {
      Alert.alert(
        'Incomplete Route',
        `You have ${remaining} remaining gates unscanned. Are you sure you want to finalize this patrol?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Finalize Anyway', style: 'destructive', onPress: confirmAndComplete },
        ]
      );
    } else {
      confirmAndComplete();
    }
  };

  const openScanForm = (gateId: string) => {
    setScanningGateId(gateId);
    setRemarks('');
    setShowScanForm(true);
  };

  const handleScanSubmit = async () => {
    if (!scanningGateId) return;
    try {
      // Send current coordinates schematically or mock them if offline
      const lat = assignment?.site?.latitude || 34.0522;
      const lng = assignment?.site?.longitude || -118.2437;

      await scanCheckpoint({
        gateId: scanningGateId,
        remarks: remarks.trim() || undefined,
        latitude: lat,
        longitude: lng,
      });

      setShowScanForm(false);
      setScanningGateId(null);
      Alert.alert('Gate Scanned', 'Checkpoint registered successfully.');
    } catch (err: any) {
      Alert.alert('Scan Failed', err.message || 'Failed to register gate.');
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  };

  const routeGates = assignment?.patrolRoute?.routeGates || [];
  const totalGates = routeGates.length;
  const scannedCount = scannedGateIds.length;
  const remainingCount = totalGates - scannedCount;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      
      {/* Offline Alert Bar */}
      {!isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.danger }]}>
          <Text style={styles.offlineText}>OFFLINE MODE — Saving actions locally</Text>
        </View>
      )}
      {queueLength > 0 && (
        <View style={[styles.syncBanner, { backgroundColor: colors.primary }]}>
          <Text style={styles.syncText}>🔄 {queueLength} Actions Pending Network Sync</Text>
        </View>
      )}

      {/* Screen Header */}
      <Text style={[styles.title, { color: colors.text }]}>Checkpoint Patrol</Text>

      {/* NO ACTIVE SESSION */}
      {!activeSession && (
        <View style={styles.startContainer}>
          {assignment ? (
            <Card style={styles.assignmentCard}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Today's Target Route</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Site: {assignment.site?.name}
              </Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Route: {assignment.patrolRoute?.name} ({totalGates} Gates)
              </Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Shift: {assignment.shift?.startTime} - {assignment.shift?.endTime}
              </Text>

              <Button
                title="Initiate Shift Patrol"
                onPress={handleStart}
                loading={isStarting}
                style={styles.startButton}
              />
            </Card>
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No active assignment found for today. Cannot start a patrol route sweep.
              </Text>
            </Card>
          )}
        </View>
      )}

      {/* ACTIVE OR PAUSED SESSION */}
      {activeSession && (
        <View style={styles.activeContainer}>
          {/* Status Header */}
          <Card style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View>
                <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Active Patrol Timer</Text>
                <Text style={[styles.timer, { color: colors.text }]}>{formatDuration(elapsedSeconds)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: activeSession.status === 'IN_PROGRESS' ? colors.success + '20' : colors.warning + '20' }]}>
                <Text style={[styles.badgeText, { color: activeSession.status === 'IN_PROGRESS' ? colors.success : colors.warning }]}>
                  {activeSession.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'PAUSED'}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressHeader}>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                Checkpoints Scanned: {scannedCount} / {totalGates}
              </Text>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {remainingCount} Remaining
              </Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${totalGates > 0 ? (scannedCount / totalGates) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          </Card>

          <Button
            title="Scan Checkpoint (QR Camera)"
            onPress={() => navigation.navigate('Scanner')}
            disabled={activeSession.status !== 'IN_PROGRESS'}
            style={{ marginBottom: 20 }}
          />

          {/* Scan Gate Remarks Overlay */}
          {showScanForm && (
            <Card style={[styles.remarksCard, { borderColor: colors.primary }]}>
              <Text style={[styles.remarksTitle, { color: colors.text }]}>Add Remarks (Optional)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="Log check-point remarks (hazard observation, clear status, etc.)"
                placeholderTextColor={colors.textSecondary}
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={3}
              />
              <View style={styles.remarksButtons}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowScanForm(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                  onPress={handleScanSubmit}
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Scan Gate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Gate Checklist */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Gates Route Checklist</Text>
          {routeGates.map((rg: any) => {
            const isScanned = scannedGateIds.includes(rg.gateId);

            return (
              <Card key={rg.id} style={styles.gateCard}>
                <View style={styles.gateRow}>
                  <View style={[styles.sequenceBadge, { backgroundColor: isScanned ? colors.success : colors.border }]}>
                    <Text style={styles.sequenceText}>{rg.sequence}</Text>
                  </View>
                  <View style={styles.gateDetails}>
                    <Text style={[styles.gateName, { color: colors.text }]}>{rg.gate?.name}</Text>
                    <Text style={[styles.gateCode, { color: colors.textSecondary }]}>Code: {rg.gate?.gateCode}</Text>
                  </View>
                  {isScanned ? (
                    <Text style={[styles.scannedBadgeText, { color: colors.success }]}>✓ Scanned</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.scanButton, { backgroundColor: colors.primary }]}
                      onPress={() => openScanForm(rg.gateId)}
                      disabled={activeSession.status !== 'IN_PROGRESS'}
                    >
                      <Text style={styles.scanButtonText}>Scan</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          })}

          {/* Control Actions */}
          <View style={styles.controlRow}>
            {activeSession.status === 'IN_PROGRESS' ? (
              <Button
                title="Pause Patrol"
                variant="outline"
                onPress={handlePause}
                loading={isPausing}
                style={styles.controlButton}
              />
            ) : (
              <Button
                title="Resume Patrol"
                onPress={handleResume}
                loading={isResuming}
                style={styles.controlButton}
              />
            )}
            <Button
              title="Complete Patrol"
              variant="danger"
              onPress={handleComplete}
              loading={isCompleting}
              style={styles.controlButton}
            />
          </View>
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
  offlineBanner: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  offlineText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  syncBanner: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  syncText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  startContainer: {
    marginTop: 20,
  },
  assignmentCard: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    marginTop: 4,
  },
  startButton: {
    marginTop: 20,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  activeContainer: {
    marginTop: 10,
  },
  statusCard: {
    padding: 16,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timer: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  remarksCard: {
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  remarksTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 70,
  },
  remarksButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmButton: {
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  gateCard: {
    padding: 12,
    marginBottom: 10,
  },
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sequenceBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sequenceText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  gateDetails: {
    flex: 1,
  },
  gateName: {
    fontSize: 13,
    fontWeight: '700',
  },
  gateCode: {
    fontSize: 11,
    marginTop: 2,
  },
  scannedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scanButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 30,
  },
  controlButton: {
    flex: 0.48,
  },
});
