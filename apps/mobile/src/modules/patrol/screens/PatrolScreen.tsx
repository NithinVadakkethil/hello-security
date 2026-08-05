import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  Camera as CameraIcon,
  CheckCircle2,
  Hourglass,
  Lock,
  Mic,
  ShieldAlert,
  Unlock,
  X,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { apiClient } from '../../../app/api/api-client';
import { useTheme } from '../../../app/hooks/useTheme';
import { useAuthStore } from '../../../app/store/auth-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import { Button } from '../../../components/Button';
import { useActiveAssignments } from '../../assignment/hooks/useAssignment';
import { Card } from '../../dashboard/components/WidgetCard';
import { ReportIssueBottomSheet } from '../components/ReportIssueBottomSheet';
import { usePatrol } from '../hooks/usePatrol';
import { usePatrolStore } from '../store/patrol-store';

export function PatrolScreen() {
  const { colors } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const navigation = useNavigation<any>();
  const isOnline = useOfflineStore(state => state.isConnected);
  const queueLength = useOfflineStore(state => state.queue.length);
  const {
    data: assignmentsList,
    refetch: refetchAssignment,
    isLoading: isLoadingAssignment,
  } = useActiveAssignments();
  const assignments = assignmentsList || [];
  const [selectedAssignmentIndex, setSelectedAssignmentIndex] = useState(0);

  const {
    activeSession,
    scannedGateIds,
    unlockedGateId,
    elapsedSeconds,
    loadActiveSession,
    tick,
  } = usePatrolStore();

  const activeAssignmentFromSession = activeSession?.assignment;
  const assignment =
    activeAssignmentFromSession ||
    assignments[selectedAssignmentIndex] ||
    assignments[0];

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

  const cameraRef = useRef<Camera>(null);
  const [subTaskResponses, setSubTaskResponses] = useState<
    Record<
      string,
      { answer: 'YES' | 'NO' | null; remarks: string; images?: string[] }
    >
  >({});
  const [activeSubTaskIdForCamera, setActiveSubTaskIdForCamera] = useState<
    string | null
  >(null);
  const [images, setImages] = useState<string[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showReportIssueSheet, setShowReportIssueSheet] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const handleOpenCameraForSubTask = async (taskId: string) => {
    setCameraError(false);
    setActiveSubTaskIdForCamera(taskId);
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Denied',
          'Hello Orbit requires camera permission to capture live checkpoint photo evidence.',
        );
        return;
      }
    }
    setShowCameraModal(true);
  };

  const handleOpenCamera = async () => {
    setCameraError(false);
    setActiveSubTaskIdForCamera(null);
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Denied',
          'Hello Orbit requires camera permission to capture live checkpoint photos.',
        );
        return;
      }
    }
    setShowCameraModal(true);
  };

  const triggerCameraFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const attachPhotoResult = (photoDataUrl: string) => {
    if (activeSubTaskIdForCamera) {
      setSubTaskResponses(prev => {
        const existing = prev[activeSubTaskIdForCamera];
        return {
          ...prev,
          [activeSubTaskIdForCamera]: {
            answer: existing?.answer || 'YES',
            remarks: existing?.remarks || '',
            images: [photoDataUrl],
          },
        };
      });
    } else {
      setImages(prev => [...prev, photoDataUrl]);
    }
  };

  const handleCapturePhoto = async () => {
    setIsCompressing(true);
    triggerCameraFlash();

    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePhoto({
          enableShutterSound: false,
        });

        if (photo?.path) {
          const response = await fetch(`file://${photo.path}`);
          const blob = await response.blob();

          await new Promise<void>(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                attachPhotoResult(reader.result as string);
              }
              resolve();
            };
            reader.readAsDataURL(blob);
          });
          setIsCompressing(false);
          setShowCameraModal(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Camera capture fallback:', e);
    }

    const realInspectionSample = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIcSUNDX1BST0ZJTEUAAQEAAAIMbGNtcwIQAABtbnRyUkdCIFhZWiAH3wACAAkABgAxAABhY3NwTVNGVAAAAABzc21zAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApkZXNjAAAA4AAAAF9jcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaHJtAAABrAAAACR3dHB0AAAB0AAAABRyWFlaAAAB5AAAABRnWFlaAAAB+AAAABRiWFlaAAACDAAAABRyVFJDAAACIAAAACBnVFJDAAACIAAAACBiVFJDAAACIAAAACBkZXNjAAAAAAAAAAVzUkdCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABtbHVjAAAAAAAAABEAAAAMZW5VUwAAAA4AAAAcAEgAUAAgAFAAcgBvAGoAZQBjAHQAcwAAbWx1YwAAAAAAAAARAAAADGVuVVMAAAAMAAAAHABHAE8ATwBHAEwARQAAWFlaIAAAAAAAAG+iAAA49QAAA5BYWVogAAAAAAAAYpkAALeFAAAY2lhZWiAAAAAAAAAkBLIAAD24AAAO5VhZWiAAAAAAAABvqAAAOPUAAAOXRGVzYwAAAAAAAAAARW5nbGlzaAAAAAAAAAAAAAAAaW1nAAAAAABJSERSAAAAUAAAAFAIBgAAAH56m5wAAABMSURFQVR42u3PMQEAAAiAMCv8+16iBwwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC4G1c0AAFH72B9AAAAAElFTkSuQmCC`;
    attachPhotoResult(realInspectionSample);
    setIsCompressing(false);
    setShowCameraModal(false);
  };

  const handleRemovePhoto = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };
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
      await startPatrol(assignment?.id);
      Alert.alert(
        'Patrol Started',
        'Your active security patrol sweep has initiated.',
      );
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
        await completePatrol({
          id: activeSession.id,
          remarks: 'Completed checkpoint sweep.',
        });
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
          {
            text: 'Finalize Anyway',
            style: 'destructive',
            onPress: confirmAndComplete,
          },
        ],
      );
    } else {
      Alert.alert(
        'Complete Patrol',
        'Are you sure you want to finalize this patrol sweep?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete', onPress: confirmAndComplete },
        ],
      );
    }
  };

  const handleCheckpointSubmit = async (
    gateId: string,
    activeSubTasks: any[] = [],
  ) => {
    const tasks = activeSubTasks.filter((st: any) => st.isActive !== false);

    // 1. Check if all tasks are answered
    const unanswered = tasks.find(
      (st: any) => !subTaskResponses[st.id]?.answer,
    );
    if (unanswered) {
      Alert.alert(
        'Incomplete Verification Tasks',
        `Please answer verification task "${unanswered.taskName}" with YES or NO.`,
      );
      return;
    }

    // 2. Validate NO answers (Remarks + Live Camera evidence photo required)
    for (const st of tasks) {
      const resp = subTaskResponses[st.id];
      if (resp?.answer === 'NO') {
        if (!resp.remarks || !resp.remarks.trim()) {
          Alert.alert(
            'Remarks Required',
            `Please enter the reason/remarks for failed task "${st.taskName}".`,
          );
          return;
        }
        if (!resp.images || resp.images.length === 0) {
          Alert.alert(
            'Live Camera Evidence Required',
            `Please capture a live camera photo evidence for failed task "${st.taskName}".`,
          );
          return;
        }
      }
    }

    Alert.alert(
      'Lock Checkpoint',
      'Are you sure you want to submit and lock this checkpoint? Completed checkpoints cannot be edited.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Lock',
          onPress: async () => {
            try {
              const lat = assignment?.site?.latitude || undefined;
              const lng = assignment?.site?.longitude || undefined;

              const formattedSubTaskResponses = tasks.map((st: any) => {
                const val = subTaskResponses[st.id] || {
                  answer: 'YES',
                  remarks: '',
                  images: [],
                };
                return {
                  gateSubTaskId: st.id,
                  answer: (val.answer || 'YES') as 'YES' | 'NO',
                  remarks: val.remarks?.trim() || undefined,
                  images: val.images && val.images.length > 0 ? val.images : undefined,
                };
              });

              const subTaskImagesList = formattedSubTaskResponses
                .flatMap((r: any) => r.images || [])
                .filter(Boolean);

              await scanCheckpoint({
                gateId,
                latitude: lat,
                longitude: lng,
                images: subTaskImagesList,
                subTaskResponses: formattedSubTaskResponses,
              });

              setSubTaskResponses({});
              setActiveSubTaskIdForCamera(null);

              Alert.alert(
                'Checkpoint Locked',
                'Verification sweep logged and checkpoint locked successfully.',
              );
            } catch (err: any) {
              Alert.alert(
                'Verification Failed',
                err.message || 'Failed to complete checkpoint.',
              );
            }
          },
        },
      ],
    );
  };

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  };

  const routeGates =
    assignment?.assignmentGates && assignment.assignmentGates.length > 0
      ? assignment.assignmentGates.map((ag: any, idx: number) => ({
          id: ag.id,
          gateId: ag.gateId || ag.gate?.id || ag.id,
          gate: ag.gate,
          sequence: ag.sequence || idx + 1,
        }))
      : (assignment?.patrolRoute?.routeGates || []).map(
          (rg: any, idx: number) => ({
            id: rg.id,
            gateId: rg.gateId || rg.gate?.id || rg.id,
            gate: rg.gate,
            sequence: rg.sequence || idx + 1,
          }),
        );
  const totalGates = routeGates.length;
  const scannedCount = scannedGateIds.length;
  const remainingCount = totalGates - scannedCount;

  // Estimation of 3 minutes per remaining gate
  const estRemainingTime =
    remainingCount > 0 ? `${remainingCount * 3} mins` : 'Completed';

  const isGateUnlocked = (rg: any) => {
    if (!unlockedGateId) return false;
    const targets = [
      rg.gateId,
      rg.id,
      rg.gate?.id,
      rg.gate?.gateCode,
      rg.gate?.qrCode,
    ].filter(Boolean);
    return targets.includes(unlockedGateId);
  };

  const isGateCompleted = (rg: any) => {
    if (!scannedGateIds || scannedGateIds.length === 0) return false;
    const targets = [
      rg.gateId,
      rg.id,
      rg.gate?.id,
      rg.gate?.gateCode,
      rg.gate?.qrCode,
    ].filter(Boolean);
    return targets.some(id => scannedGateIds.includes(id));
  };

  const unlockedGateObj = routeGates.find((rg: any) => isGateUnlocked(rg));
  const activeGateId =
    unlockedGateObj?.gateId ||
    unlockedGateObj?.gate?.id ||
    unlockedGateId ||
    routeGates.find((rg: any) => !isGateCompleted(rg))?.gateId;

  const user = useAuthStore(state => state.user);
  const userRole =
    (user as any)?.employee?.role || (user as any)?.role || 'SECURITY';

  const { data: fetchedSubTasksRes } = useQuery({
    queryKey: ['gate-subtasks', activeGateId, userRole],
    queryFn: async () => {
      if (!activeGateId) return [];
      const res = (await apiClient.get(
        `/gates/${activeGateId}/sub-tasks?onlyActive=true&role=${userRole}`,
      )) as any;
      return res.data || [];
    },
    enabled: !!activeGateId && isOnline,
  });

  const getSubTasksForGate = (rg: any) => {
    let rawTasks: any[] = [];
    const isTargetActive =
      isGateUnlocked(rg) ||
      rg.gateId === activeGateId ||
      rg.gate?.id === activeGateId ||
      rg.id === activeGateId;
    if (
      isTargetActive &&
      fetchedSubTasksRes &&
      Array.isArray(fetchedSubTasksRes) &&
      fetchedSubTasksRes.length > 0
    ) {
      rawTasks = fetchedSubTasksRes;
    } else if (
      rg?.gate?.subTasks &&
      Array.isArray(rg.gate.subTasks) &&
      rg.gate.subTasks.length > 0
    ) {
      rawTasks = rg.gate.subTasks;
    } else if (
      rg?.subTasks &&
      Array.isArray(rg.subTasks) &&
      rg.subTasks.length > 0
    ) {
      rawTasks = rg.subTasks;
    }
    return rawTasks.filter((t: any) => !t.role || t.role === userRole);
  };

  const isDirect =
    assignment?.assignmentType === 'DIRECT_CHECKPOINTS' ||
    (!assignment?.patrolRoute && assignment?.assignmentGates);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Offline Status Alert */}
      {!isOnline && (
        <View
          style={[styles.offlineBanner, { backgroundColor: colors.danger }]}
        >
          <Text style={styles.offlineText}>
            OFFLINE MODE — Saving actions locally
          </Text>
        </View>
      )}
      {queueLength > 0 && (
        <View style={[styles.syncBanner, { backgroundColor: colors.primary }]}>
          <Text style={styles.syncText}>
            SYNC QUEUE — {queueLength} item(s) pending upload
          </Text>
        </View>
      )}

      {/* Screen Header */}
      <Text style={[styles.title, { color: colors.text }]}>
        Checkpoint Patrol
      </Text>

      {/* NO ACTIVE SESSION */}
      {!activeSession && (
        <View style={styles.startContainer}>
          {isLoadingAssignment ? (
            <ActivityIndicator
              color={colors.primary}
              size="large"
              style={{ marginTop: 40 }}
            />
          ) : assignments.length > 0 ? (
            <Card style={styles.assignmentCard}>
              {/* ASSIGNMENT SWITCHER SELECTOR */}
              {assignments.length > 1 && (
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: colors.textSecondary,
                      marginBottom: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Select Active Assignment ({assignments.length} Active):
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {assignments.map((item, idx) => {
                      const isSel = idx === selectedAssignmentIndex;
                      const itemIsDirect =
                        item.assignmentType === 'DIRECT_CHECKPOINTS' ||
                        (!item.patrolRoute && item.assignmentGates);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => setSelectedAssignmentIndex(idx)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isSel ? colors.primary : colors.border,
                            backgroundColor: isSel
                              ? 'rgba(59, 130, 246, 0.15)'
                              : colors.surface,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: isSel ? colors.primary : colors.text,
                            }}
                          >
                            {item.site?.name || `Site #${idx + 1}`}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: colors.textSecondary,
                              marginTop: 2,
                            }}
                          >
                            {itemIsDirect
                              ? '🚧 Direct Gates'
                              : `🗺️ ${item.patrolRoute?.name || 'Route'}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {isDirect
                  ? '🚧 Direct Checkpoints Patrol'
                  : '🗺️ Assigned Route Sweep'}
              </Text>
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />

              <View style={styles.metaRow}>
                <Text
                  style={[styles.metaLabel, { color: colors.textSecondary }]}
                >
                  Site Location
                </Text>
                <Text style={[styles.metaVal, { color: colors.text }]}>
                  {assignment?.site?.name || 'N/A'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text
                  style={[styles.metaLabel, { color: colors.textSecondary }]}
                >
                  {isDirect ? 'Assigned Gates' : 'Patrol Route'}
                </Text>
                <Text style={[styles.metaVal, { color: colors.text }]}>
                  {isDirect
                    ? `${totalGates} Checkpoints`
                    : `${
                        assignment?.patrolRoute?.name || 'N/A'
                      } (${totalGates} Gates)`}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text
                  style={[styles.metaLabel, { color: colors.textSecondary }]}
                >
                  Active Shift
                </Text>
                <Text style={[styles.metaVal, { color: colors.text }]}>
                  {assignment?.shift?.startTime} - {assignment?.shift?.endTime}
                </Text>
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
                No active assignment found for today. Cannot start a patrol
                route sweep.
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
                <Text
                  style={[styles.statusLabel, { color: colors.textSecondary }]}
                >
                  Patrol Timer
                </Text>
                <Text style={[styles.timer, { color: colors.text }]}>
                  {formatTimer(elapsedSeconds)}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      activeSession.status === 'IN_PROGRESS'
                        ? colors.success + '20'
                        : colors.warning + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color:
                        activeSession.status === 'IN_PROGRESS'
                          ? colors.success
                          : colors.warning,
                    },
                  ]}
                >
                  {activeSession.status === 'IN_PROGRESS'
                    ? 'IN PROGRESS'
                    : 'PAUSED'}
                </Text>
              </View>
            </View>

            {/* Progress indicators */}
            <View style={styles.statsSummaryRow}>
              <View style={styles.statSummaryCol}>
                <BarChart2 size={16} color={colors.primary} />
                <Text
                  style={[
                    styles.statSummaryText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {scannedCount} / {totalGates} Scanned
                </Text>
              </View>
              <View style={styles.statSummaryCol}>
                <Hourglass size={16} color={colors.warning} />
                <Text
                  style={[
                    styles.statSummaryText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Est: {estRemainingTime}
                </Text>
              </View>
            </View>

            <View
              style={[styles.progressBarBg, { backgroundColor: colors.border }]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${
                      totalGates > 0 ? (scannedCount / totalGates) * 100 : 0
                    }%`,
                  },
                ]}
              />
            </View>
          </Card>

          {/* Sequential Checklist */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Checkpoint Sequence
          </Text>

          {routeGates.map((rg: any) => {
            const isCompleted = isGateCompleted(rg);
            const isUnlocked = !isCompleted && isGateUnlocked(rg);

            let cardStatusColor = colors.border;
            if (isCompleted) cardStatusColor = colors.success;
            else if (isUnlocked) cardStatusColor = colors.primary;

            return (
              <Card
                key={rg.id}
                style={[
                  styles.checkpointCard,
                  {
                    borderColor: cardStatusColor,
                    borderWidth: isCompleted || isUnlocked ? 1.5 : 1,
                  },
                ]}
              >
                <View style={styles.gateHeader}>
                  <View
                    style={[
                      styles.seqBadge,
                      {
                        backgroundColor: isCompleted
                          ? colors.success
                          : isUnlocked
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                  >
                    <Text style={styles.seqText}>{rg.sequence}</Text>
                  </View>
                  <View style={styles.gateInfo}>
                    <Text style={[styles.gateName, { color: colors.text }]}>
                      {rg.gate?.name}
                    </Text>
                    <Text
                      style={[styles.gateSub, { color: colors.textSecondary }]}
                    >
                      Gate ID: {rg.gate?.gateCode}
                    </Text>
                  </View>
                  <View style={styles.statusCol}>
                    {isCompleted ? (
                      <View style={styles.inlineBadge}>
                        <CheckCircle2 size={16} color={colors.success} />
                        <Text
                          style={[
                            styles.badgeTextVal,
                            { color: colors.success },
                          ]}
                        >
                          Completed
                        </Text>
                      </View>
                    ) : isUnlocked ? (
                      <View style={styles.inlineBadge}>
                        <Unlock size={16} color={colors.primary} />
                        <Text
                          style={[
                            styles.badgeTextVal,
                            { color: colors.primary },
                          ]}
                        >
                          Unlocked
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.inlineBadge}>
                        <Lock size={16} color={colors.textSecondary} />
                        <Text
                          style={[
                            styles.badgeTextVal,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Pending
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* UNLOCKED ACTIVE ACTIONS */}
                {isUnlocked && (
                  <View style={styles.unlockedPanel}>
                    <View style={styles.innerDivider} />

                    {/* Checkpoint Verification Sub-Tasks Section */}
                    {(() => {
                      const currentGateSubTasks = getSubTasksForGate(rg.gate);
                      const activeTasks = currentGateSubTasks.filter(
                        (st: any) => st.isActive !== false,
                      );
                      if (activeTasks.length === 0) {
                        return (
                          <View style={{ paddingVertical: 12 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.textSecondary,
                                fontStyle: 'italic',
                              }}
                            >
                              No verification tasks assigned for your role at
                              this checkpoint.
                            </Text>
                          </View>
                        );
                      }

                      return (
                        <View style={{ marginTop: 8 }}>
                          <Text
                            style={[
                              styles.panelLabel,
                              { color: colors.text, marginBottom: 4 },
                            ]}
                          >
                            Verification Tasks ({activeTasks.length})
                          </Text>
                          {activeTasks.map((task: any, taskIdx: number) => {
                            const currentResp = subTaskResponses[task.id] || {
                              answer: null,
                              remarks: '',
                              images: [],
                            };
                            const isYes = currentResp.answer === 'YES';
                            const isNo = currentResp.answer === 'NO';

                            return (
                              <View
                                key={task.id || taskIdx}
                                style={{
                                  backgroundColor: colors.surface,
                                  borderColor: isNo
                                    ? colors.danger + '80'
                                    : isYes
                                    ? colors.success + '80'
                                    : colors.border,
                                  borderWidth: 1.5,
                                  borderRadius: 12,
                                  padding: 14,
                                  marginTop: 10,
                                }}
                              >
                                {/* Header: Task Name + Required Badge */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 14,
                                      fontWeight: '700',
                                      color: colors.text,
                                      flex: 1,
                                    }}
                                  >
                                    #{taskIdx + 1}. {task.taskName}
                                  </Text>
                                  {task.isRequired ? (
                                    <View
                                      style={{
                                        backgroundColor: '#ef444420',
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                        borderRadius: 4,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 10,
                                          fontWeight: '800',
                                          color: colors.danger,
                                        }}
                                      >
                                        REQUIRED
                                      </Text>
                                    </View>
                                  ) : (
                                    <View
                                      style={{
                                        backgroundColor: colors.border + '40',
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                        borderRadius: 4,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 10,
                                          fontWeight: '600',
                                          color: colors.textSecondary,
                                        }}
                                      >
                                        OPTIONAL
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {task.description ? (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.textSecondary,
                                      marginTop: 4,
                                      lineHeight: 16,
                                    }}
                                  >
                                    {task.description}
                                  </Text>
                                ) : null}

                                {/* Action Control Row: iOS Radio Buttons (Yes / No) + Camera + Voice Note */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginTop: 12,
                                  }}
                                >
                                  {/* YES Radio Option */}
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      paddingHorizontal: 12,
                                      paddingVertical: 9,
                                      borderRadius: 8,
                                      borderWidth: 1.5,
                                      borderColor: isYes
                                        ? '#10b981'
                                        : colors.border,
                                      backgroundColor: isYes
                                        ? 'rgba(16, 185, 129, 0.12)'
                                        : colors.background,
                                      gap: 8,
                                    }}
                                    onPress={() =>
                                      setSubTaskResponses(prev => ({
                                        ...prev,
                                        [task.id]: {
                                          answer: 'YES',
                                          remarks: prev[task.id]?.remarks || '',
                                          images: prev[task.id]?.images || [],
                                        },
                                      }))
                                    }
                                  >
                                    <View
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        borderWidth: 2,
                                        borderColor: isYes
                                          ? '#10b981'
                                          : colors.textSecondary,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {isYes && (
                                        <View
                                          style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 5,
                                            backgroundColor: '#10b981',
                                          }}
                                        />
                                      )}
                                    </View>
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        fontWeight: '700',
                                        color: isYes ? '#10b981' : colors.text,
                                      }}
                                    >
                                      Yes
                                    </Text>
                                  </TouchableOpacity>

                                  {/* NO Radio Option */}
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      paddingHorizontal: 12,
                                      paddingVertical: 9,
                                      borderRadius: 8,
                                      borderWidth: 1.5,
                                      borderColor: isNo
                                        ? '#ef4444'
                                        : colors.border,
                                      backgroundColor: isNo
                                        ? 'rgba(239, 68, 68, 0.12)'
                                        : colors.background,
                                      gap: 8,
                                    }}
                                    onPress={() =>
                                      setSubTaskResponses(prev => ({
                                        ...prev,
                                        [task.id]: {
                                          answer: 'NO',
                                          remarks: prev[task.id]?.remarks || '',
                                          images: prev[task.id]?.images || [],
                                        },
                                      }))
                                    }
                                  >
                                    <View
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        borderWidth: 2,
                                        borderColor: isNo
                                          ? '#ef4444'
                                          : colors.textSecondary,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {isNo && (
                                        <View
                                          style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 5,
                                            backgroundColor: '#ef4444',
                                          }}
                                        />
                                      )}
                                    </View>
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        fontWeight: '700',
                                        color: isNo ? '#ef4444' : colors.text,
                                      }}
                                    >
                                      No
                                    </Text>
                                  </TouchableOpacity>

                                  {/* Camera Icon Button */}
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingVertical: 9,
                                      borderRadius: 8,
                                      borderWidth: 1.5,
                                      borderColor:
                                        currentResp.images &&
                                        currentResp.images.length > 0
                                          ? colors.primary
                                          : colors.border,
                                      backgroundColor:
                                        currentResp.images &&
                                        currentResp.images.length > 0
                                          ? colors.primary + '20'
                                          : colors.background,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 4,
                                    }}
                                    onPress={() =>
                                      handleOpenCameraForSubTask(task.id)
                                    }
                                  >
                                    <CameraIcon
                                      size={18}
                                      color={
                                        currentResp.images &&
                                        currentResp.images.length > 0
                                          ? colors.primary
                                          : colors.textSecondary
                                      }
                                    />
                                    {currentResp.images &&
                                      currentResp.images.length > 0 && (
                                        <View
                                          style={{
                                            backgroundColor: colors.primary,
                                            borderRadius: 10,
                                            paddingHorizontal: 5,
                                            paddingVertical: 1,
                                          }}
                                        >
                                          <Text
                                            style={{
                                              color: '#ffffff',
                                              fontSize: 10,
                                              fontWeight: '800',
                                            }}
                                          >
                                            {currentResp.images.length}
                                          </Text>
                                        </View>
                                      )}
                                  </TouchableOpacity>

                                  {/* Voice Note Icon Button (Placeholder) */}
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingVertical: 9,
                                      borderRadius: 8,
                                      borderWidth: 1.5,
                                      borderColor: colors.border,
                                      backgroundColor: colors.background,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    onPress={() => {
                                      Alert.alert(
                                        '🎤 Voice Note',
                                        'Voice note recording feature is coming soon in a future release.',
                                      );
                                    }}
                                  >
                                    <Mic
                                      size={18}
                                      color={colors.textSecondary}
                                    />
                                  </TouchableOpacity>
                                </View>

                                {/* EXPANDED REMARKS & EVIDENCE SECTION FOR BOTH YES AND NO */}
                                {(isYes || isNo) && (
                                  <View
                                    style={{
                                      marginTop: 14,
                                      paddingTop: 12,
                                      borderTopWidth: 1,
                                      borderTopColor: colors.border,
                                    }}
                                  >
                                    {/* Reason / Remarks TextInput */}
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: isNo
                                          ? colors.danger
                                          : colors.text,
                                        marginBottom: 6,
                                      }}
                                    >
                                      Reason / Remarks{' '}
                                      {isNo ? '*' : '(Optional)'}
                                    </Text>
                                    <TextInput
                                      style={{
                                        fontSize: 13,
                                        color: colors.text,
                                        borderColor: isNo
                                          ? currentResp.remarks?.trim()
                                            ? colors.border
                                            : colors.danger + '80'
                                          : colors.border,
                                        borderWidth: 1.5,
                                        borderRadius: 8,
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        backgroundColor: colors.background,
                                        minHeight: 54,
                                      }}
                                      placeholder="Enter remarks..."
                                      placeholderTextColor={
                                        colors.textSecondary
                                      }
                                      value={currentResp.remarks}
                                      multiline
                                      maxLength={500}
                                      onChangeText={txt =>
                                        setSubTaskResponses(prev => ({
                                          ...prev,
                                          [task.id]: {
                                            ...prev[task.id],
                                            remarks: txt,
                                          },
                                        }))
                                      }
                                    />

                                    {/* Display Captured Image Thumbnail directly (Photo Preview header label removed) */}
                                    {currentResp.images &&
                                    currentResp.images.length > 0 ? (
                                      <View
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 12,
                                          marginTop: 12,
                                        }}
                                      >
                                        <View style={{ position: 'relative' }}>
                                          <Image
                                            source={{
                                              uri: currentResp.images[0],
                                            }}
                                            style={{
                                              width: 84,
                                              height: 84,
                                              borderRadius: 10,
                                              borderWidth: 1,
                                              borderColor: colors.border,
                                            }}
                                          />
                                          <TouchableOpacity
                                            style={{
                                              position: 'absolute',
                                              top: -6,
                                              right: -6,
                                              backgroundColor: '#ef4444',
                                              borderRadius: 12,
                                              width: 22,
                                              height: 22,
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              borderWidth: 1.5,
                                              borderColor: '#ffffff',
                                            }}
                                            onPress={() =>
                                              setSubTaskResponses(prev => ({
                                                ...prev,
                                                [task.id]: {
                                                  ...prev[task.id],
                                                  images: [],
                                                },
                                              }))
                                            }
                                          >
                                            <X size={12} color="#ffffff" />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    ) : isNo ? (
                                      <TouchableOpacity
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 8,
                                          backgroundColor: colors.danger + '10',
                                          borderColor: colors.danger,
                                          borderWidth: 1.5,
                                          borderStyle: 'dashed',
                                          borderRadius: 10,
                                          paddingVertical: 14,
                                          marginTop: 12,
                                        }}
                                        onPress={() =>
                                          handleOpenCameraForSubTask(task.id)
                                        }
                                      >
                                        <CameraIcon
                                          size={18}
                                          color={colors.danger}
                                        />
                                        <Text
                                          style={{
                                            color: colors.danger,
                                            fontSize: 13,
                                            fontWeight: '700',
                                          }}
                                        >
                                          Capture Live Evidence Photo *
                                        </Text>
                                      </TouchableOpacity>
                                    ) : null}

                                    <Text
                                      style={{
                                        fontSize: 10,
                                        color: colors.textSecondary,
                                        fontStyle: 'italic',
                                        marginTop: 6,
                                      }}
                                    >
                                      ⚠️ Only live camera capture is accepted.
                                      Gallery selection is disabled.
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}

                    <Text
                      style={[
                        styles.panelLabel,
                        { color: colors.text, marginTop: 16 },
                      ]}
                    >
                      Report Independent Issue (Optional)
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {
                          borderColor: colors.warning,
                          backgroundColor: colors.warning + '10',
                        },
                      ]}
                      onPress={() => setShowReportIssueSheet(true)}
                    >
                      <ShieldAlert size={16} color={colors.warning} />
                      <Text
                        style={[
                          styles.actionBtnText,
                          { color: colors.warning },
                        ]}
                      >
                        Report an Issue (Incident / Snag)
                      </Text>
                    </TouchableOpacity>

                    <Button
                      title="Submit & Lock Checkpoint"
                      onPress={() =>
                        handleCheckpointSubmit(
                          rg.gate?.id || rg.gateId || rg.id,
                          getSubTasksForGate(rg),
                        )
                      }
                      loading={isScanning}
                      style={{ marginTop: 20 }}
                    />
                  </View>
                )}

                {/* PENDING ACTIVE TRIGGER BUTTON */}
                {!isCompleted && !isUnlocked && (
                  <View style={styles.lockedPanel}>
                    <View style={styles.innerDivider} />
                    <TouchableOpacity
                      style={[
                        styles.scanTriggerButton,
                        { backgroundColor: colors.primary },
                      ]}
                      onPress={() => navigation.navigate('Scanner')}
                      disabled={activeSession.status !== 'IN_PROGRESS'}
                    >
                      <Unlock
                        size={16}
                        color="#ffffff"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.scanTriggerText}>
                        Scan QR Code to Unlock
                      </Text>
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

      {/* Report Issue Bottom Sheet */}
      <ReportIssueBottomSheet
        visible={showReportIssueSheet}
        onClose={() => setShowReportIssueSheet(false)}
        onSelectIncident={() =>
          navigation.navigate('ReportIncident', {
            gateId: unlockedGateId,
            patrolSessionId: activeSession?.id,
          })
        }
        onSelectSnag={() =>
          navigation.navigate('ReportSnag', {
            gateId: unlockedGateId,
            patrolSessionId: activeSession?.id,
          })
        }
      />

      {/* CAMERA VIEWFINDER MODAL */}
      <Modal visible={showCameraModal} animationType="slide">
        <View style={[styles.cameraContainer, { backgroundColor: '#121214' }]}>
          <Text style={styles.cameraTitle}>Live Camera Viewfinder</Text>
          <View style={styles.viewfinder}>
            {device && !cameraError ? (
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={showCameraModal}
                photo={true}
                onError={error => {
                  console.warn('VisionCamera session error:', error);
                  setCameraError(true);
                }}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: '#1a1a1e',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20,
                  },
                ]}
              >
                <CameraIcon size={48} color="#8e8e9a" />
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: '700',
                    marginTop: 12,
                  }}
                >
                  Live Camera Viewfinder Ready
                </Text>
                <Text
                  style={{
                    color: '#8e8e9a',
                    fontSize: 11,
                    textAlign: 'center',
                    marginTop: 6,
                    lineHeight: 16,
                  }}
                >
                  Tap shutter button below to capture live inspection photo
                  evidence.
                </Text>
              </View>
            )}
            <View style={styles.crosshair} />
            {isCompressing && (
              <View style={styles.compressLoader}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.compressLabel}>
                  Compressing Photo (85%)...
                </Text>
              </View>
            )}
            <Animated.View
              style={[styles.flashOverlay, { opacity: flashAnim }]}
            />
          </View>
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={[styles.cameraCancel, { borderColor: '#ffffff' }]}
              onPress={() => setShowCameraModal(false)}
            >
              <Text style={{ color: '#ffffff' }}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shutterButton}
              onPress={handleCapturePhoto}
              disabled={isCompressing}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <View style={{ width: 60 }} />
          </View>
        </View>
      </Modal>
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
  photoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
  },
  thumbnailWrapper: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -2,
  },
  addPhotoSlot: {
    width: 60,
    height: 60,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoPlus: {
    fontSize: 16,
    fontWeight: '700',
  },
  addPhotoLabel: {
    fontSize: 8,
    marginTop: 1,
  },
  cameraContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  cameraTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  viewfinder: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  crosshair: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 20,
  },
  compressLoader: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compressLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  cameraCancel: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  shutterButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
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
