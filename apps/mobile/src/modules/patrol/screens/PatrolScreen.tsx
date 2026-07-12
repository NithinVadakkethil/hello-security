import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { usePatrol } from '../hooks/usePatrol';
import { usePatrolStore } from '../store/patrol-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import { useActiveAssignment } from '../../assignment/hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { Button } from '../../../components/Button';
import { useNavigation } from '@react-navigation/native';
import { Play, Pause, CheckCircle2, ShieldAlert, Lock, Unlock, HelpCircle, Hourglass, BarChart2 } from 'lucide-react-native';

export function PatrolScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const isOnline = useOfflineStore((state) => state.isConnected);
  const queueLength = useOfflineStore((state) => state.queue.length);
  const { data: assignment, refetch: refetchAssignment, isLoading: isLoadingAssignment } = useActiveAssignment();

  const {
    activeSession,
    scannedGateIds,
    unlockedGateId,
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

  const [remarks, setRemarks] = useState('');
  const [gateStatus, setGateStatus] = useState<'GOOD' | 'DAMAGED' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchAssignment();
    await loadActiveSession();
    setIsRefreshing(false);
  };

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
      Alert.alert(
        'Complete Patrol',
        'Are you sure you want to finalize this patrol sweep?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete', onPress: confirmAndComplete },
        ]
      );
    }
  };

  const handleCheckpointSubmit = async (gateId: string) => {
    if (!gateStatus) {
      Alert.alert('Missing Status', 'Please report the status of the gate (Good / Damaged) before checkpoint completion.');
      return;
    }

    Alert.alert(
      'Verify Checkpoint',
      'Are you sure you want to submit and lock this checkpoint? You cannot revisit it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Log',
          onPress: async () => {
            try {
              const lat = assignment?.site?.latitude || undefined;
              const lng = assignment?.site?.longitude || undefined;
              const statusPrefix = `Status: ${gateStatus === 'GOOD' ? 'Good' : 'Damaged/Issue'}.`;
              const fullRemarks = remarks.trim() ? `${statusPrefix} ${remarks.trim()}` : statusPrefix;

              await scanCheckpoint({
                gateId,
                remarks: fullRemarks,
                latitude: lat,
                longitude: lng,
              });

              setRemarks('');
              setGateStatus(null);
              Alert.alert('Checkpoint Registered', 'Data securely transmitted and checkpoint locked.');
            } catch (err: any) {
              Alert.alert('Verification Failed', err.message || 'Failed to complete checkpoint.');
            }
          }
        }
      ]
    );
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

  // Estimation of 3 minutes per remaining gate
  const estRemainingTime = remainingCount > 0 ? `${remainingCount * 3} mins` : 'Completed';

  // Find the next assigned gate in sequence
  const nextAssignedGate = routeGates.find((rg: any) => !scannedGateIds.includes(rg.gateId));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {/* Offline Status Alert */}
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
          {isLoadingAssignment ? (
            <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
          ) : assignment ? (
            <Card style={styles.assignmentCard}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Assigned Route Sweep</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Site Location</Text>
                <Text style={[styles.metaVal, { color: colors.text }]}>{assignment.site?.name}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Patrol Route</Text>
                <Text style={[styles.metaVal, { color: colors.text }]}>{assignment.patrolRoute?.name} ({totalGates} Gates)</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Active Shift</Text>
                <Text style={[styles.metaVal, { color: colors.text }]}>{assignment.shift?.startTime} - {assignment.shift?.endTime}</Text>
              </View>

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

      {/* ACTIVE SESSION */}
      {activeSession && (
        <View style={styles.activeContainer}>
          
          {/* Progress Tracker Widget */}
          <Card style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View>
                <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Patrol Timer</Text>
                <Text style={[styles.timer, { color: colors.text }]}>{formatDuration(elapsedSeconds)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: activeSession.status === 'IN_PROGRESS' ? colors.success + '20' : colors.warning + '20' }]}>
                <Text style={[styles.badgeText, { color: activeSession.status === 'IN_PROGRESS' ? colors.success : colors.warning }]}>
                  {activeSession.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'PAUSED'}
                </Text>
              </View>
            </View>

            {/* Progress indicators */}
            <View style={styles.statsSummaryRow}>
              <View style={styles.statSummaryCol}>
                <BarChart2 size={16} color={colors.primary} />
                <Text style={[styles.statSummaryText, { color: colors.textSecondary }]}>
                  {scannedCount} / {totalGates} Scanned
                </Text>
              </View>
              <View style={styles.statSummaryCol}>
                <Hourglass size={16} color={colors.warning} />
                <Text style={[styles.statSummaryText, { color: colors.textSecondary }]}>
                  Est: {estRemainingTime}
                </Text>
              </View>
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

          {/* Sequential Checklist */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Checkpoint Sequence</Text>
          
          {routeGates.map((rg: any) => {
            const isCompleted = scannedGateIds.includes(rg.gateId);
            const isNext = nextAssignedGate?.gateId === rg.gateId;
            const isUnlocked = unlockedGateId === rg.gateId;

            let cardStatusColor = colors.border;
            if (isCompleted) cardStatusColor = colors.success;
            else if (isNext && isUnlocked) cardStatusColor = colors.primary;

            return (
              <Card
                key={rg.id}
                style={[
                  styles.checkpointCard,
                  { borderColor: cardStatusColor, borderWidth: isCompleted || (isNext && isUnlocked) ? 1.5 : 1 }
                ]}
              >
                <View style={styles.gateHeader}>
                  <View style={[styles.seqBadge, { backgroundColor: isCompleted ? colors.success : isNext ? colors.primary : colors.border }]}>
                    <Text style={styles.seqText}>{rg.sequence}</Text>
                  </View>
                  <View style={styles.gateInfo}>
                    <Text style={[styles.gateName, { color: colors.text }]}>{rg.gate?.name}</Text>
                    <Text style={[styles.gateSub, { color: colors.textSecondary }]}>Gate ID: {rg.gate?.gateCode}</Text>
                  </View>
                  <View style={styles.statusCol}>
                    {isCompleted ? (
                      <View style={styles.inlineBadge}>
                        <CheckCircle2 size={16} color={colors.success} />
                        <Text style={[styles.badgeTextVal, { color: colors.success }]}>Locked</Text>
                      </View>
                    ) : isNext && isUnlocked ? (
                      <View style={styles.inlineBadge}>
                        <Unlock size={16} color={colors.primary} />
                        <Text style={[styles.badgeTextVal, { color: colors.primary }]}>Unlocked</Text>
                      </View>
                    ) : (
                      <View style={styles.inlineBadge}>
                        <Lock size={16} color={colors.textSecondary} />
                        <Text style={[styles.badgeTextVal, { color: colors.textSecondary }]}>Locked</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* UNLOCKED ACTIVE ACTIONS */}
                {isNext && isUnlocked && (
                  <View style={styles.unlockedPanel}>
                    <View style={styles.innerDivider} />
                    
                    <Text style={[styles.panelLabel, { color: colors.text }]}>1. Gate Status (Required)</Text>
                    <View style={styles.statusButtonsRow}>
                      <TouchableOpacity
                        style={[
                          styles.statusSelector,
                          {
                            borderColor: gateStatus === 'GOOD' ? colors.success : colors.border,
                            backgroundColor: gateStatus === 'GOOD' ? colors.success + '15' : colors.surface,
                          }
                        ]}
                        onPress={() => setGateStatus('GOOD')}
                      >
                        <CheckCircle2 size={16} color={gateStatus === 'GOOD' ? colors.success : colors.textSecondary} />
                        <Text style={[styles.statusSelectorText, { color: colors.text }]}>Status: Good</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.statusSelector,
                          {
                            borderColor: gateStatus === 'DAMAGED' ? colors.danger : colors.border,
                            backgroundColor: gateStatus === 'DAMAGED' ? colors.danger + '15' : colors.surface,
                          }
                        ]}
                        onPress={() => setGateStatus('DAMAGED')}
                      >
                        <ShieldAlert size={16} color={gateStatus === 'DAMAGED' ? colors.danger : colors.textSecondary} />
                        <Text style={[styles.statusSelectorText, { color: colors.text }]}>Report Damage</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.panelLabel, { color: colors.text, marginTop: 12 }]}>2. Report Incident (Optional)</Text>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: colors.danger, backgroundColor: colors.danger + '05' }]}
                      onPress={() => navigation.navigate('Reports', { gateId: rg.gateId, patrolSessionId: activeSession.id })}
                    >
                      <ShieldAlert size={16} color={colors.danger} />
                      <Text style={[styles.actionBtnText, { color: colors.danger }]}>Trigger Incident Form</Text>
                    </TouchableOpacity>

                    <Text style={[styles.panelLabel, { color: colors.text, marginTop: 12 }]}>3. Sweep Notes</Text>
                    <TextInput
                      style={[styles.remarksInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                      placeholder="Add any verification notes or observations..."
                      placeholderTextColor={colors.textSecondary}
                      value={remarks}
                      onChangeText={setRemarks}
                      multiline
                    />

                    <Button
                      title="Submit & Lock Checkpoint"
                      onPress={() => handleCheckpointSubmit(rg.gateId)}
                      loading={isScanning}
                      style={{ marginTop: 16 }}
                    />
                  </View>
                )}

                {/* PENDING ACTIVE TRIGGER BUTTON */}
                {isNext && !isUnlocked && (
                  <View style={styles.lockedPanel}>
                    <View style={styles.innerDivider} />
                    <TouchableOpacity
                      style={[styles.scanTriggerButton, { backgroundColor: colors.primary }]}
                      onPress={() => navigation.navigate('Scanner')}
                      disabled={activeSession.status !== 'IN_PROGRESS'}
                    >
                      <Unlock size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.scanTriggerText}>Scan QR Code to Unlock</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            );
          })}

          {/* Active Patrol Action Controls */}
          <View style={styles.controlRow}>
            {activeSession.status === 'IN_PROGRESS' ? (
              <Button
                title="Pause Timer"
                variant="outline"
                onPress={handlePause}
                loading={isPausing}
                style={styles.controlButton}
              />
            ) : (
              <Button
                title="Resume Timer"
                onPress={handleResume}
                loading={isResuming}
                style={styles.controlButton}
              />
            )}
            <Button
              title="Finish Sweep"
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
    paddingBottom: 40,
  },
  offlineBanner: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  offlineText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  syncBanner: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  syncText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
  },
  startContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  assignmentCard: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  startButton: {
    marginTop: 18,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  activeContainer: {
    flex: 1,
  },
  statusCard: {
    padding: 16,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timer: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statsSummaryRow: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 12,
    gap: 16,
  },
  statSummaryCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statSummaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkpointCard: {
    padding: 14,
    marginBottom: 12,
  },
  gateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seqBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  gateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  gateName: {
    fontSize: 14,
    fontWeight: '700',
  },
  gateSub: {
    fontSize: 11,
    marginTop: 2,
  },
  statusCol: {
    alignItems: 'flex-end',
  },
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeTextVal: {
    fontSize: 11,
    fontWeight: '600',
  },
  innerDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 12,
  },
  unlockedPanel: {
    marginTop: 4,
  },
  panelLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  statusSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
  },
  statusSelectorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  remarksInput: {
    height: 60,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  lockedPanel: {
    marginTop: 4,
  },
  scanTriggerButton: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTriggerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
  controlButton: {
    flex: 1,
  },
});
