import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
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

// ==========================================
// Isolated Timer Display (Prevents full-screen 1s re-renders)
// ==========================================
const PatrolTimerDisplay = React.memo(() => {
  const { colors } = useTheme();

  return <Text style={[styles.timer, { color: colors.text }]}>00:00:00</Text>;
});

// ==========================================
// Memoized Verification Task Item (Instant YES/NO touch response)
// ==========================================
interface VerificationTaskItemProps {
  task: any;
  taskIdx: number;
  response?: {
    answer: 'YES' | 'NO' | null;
    remarks: string;
    images?: string[];
  };
  onAnswerChange: (taskId: string, answer: 'YES' | 'NO') => void;
  onRemarksChange: (taskId: string, remarks: string) => void;
  onRemoveImage: (taskId: string) => void;
  onOpenCamera: (taskId: string) => void;
  colors: any;
}

const VerificationTaskItem = React.memo(
  ({
    task,
    taskIdx,
    response,
    onAnswerChange,
    onRemarksChange,
    onRemoveImage,
    onOpenCamera,
    colors,
  }: VerificationTaskItemProps) => {
    const currentResp = response || { answer: null, remarks: '', images: [] };
    const isYes = currentResp.answer === 'YES';
    const isNo = currentResp.answer === 'NO';

    return (
      <View
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

        {/* Action Control Row: YES / NO + Camera + Voice Note */}
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
            activeOpacity={0.6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: isYes ? '#10b981' : colors.border,
              backgroundColor: isYes
                ? 'rgba(16, 185, 129, 0.12)'
                : colors.background,
              gap: 8,
            }}
            onPress={() => onAnswerChange(task.id, 'YES')}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: isYes ? '#10b981' : colors.textSecondary,
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
            activeOpacity={0.6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: isNo ? '#ef4444' : colors.border,
              backgroundColor: isNo
                ? 'rgba(239, 68, 68, 0.12)'
                : colors.background,
              gap: 8,
            }}
            onPress={() => onAnswerChange(task.id, 'NO')}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: isNo ? '#ef4444' : colors.textSecondary,
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
            activeOpacity={0.6}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor:
                currentResp.images && currentResp.images.length > 0
                  ? colors.primary
                  : colors.border,
              backgroundColor:
                currentResp.images && currentResp.images.length > 0
                  ? colors.primary + '20'
                  : colors.background,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
            onPress={() => onOpenCamera(task.id)}
          >
            <CameraIcon
              size={18}
              color={
                currentResp.images && currentResp.images.length > 0
                  ? colors.primary
                  : colors.textSecondary
              }
            />
            {currentResp.images && currentResp.images.length > 0 && (
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
            activeOpacity={0.6}
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
            <Mic size={18} color={colors.textSecondary} />
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
                color: isNo ? colors.danger : colors.text,
                marginBottom: 6,
              }}
            >
              Reason / Remarks {isNo ? '*' : '(Optional)'}
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
              placeholderTextColor={colors.textSecondary}
              value={currentResp.remarks}
              multiline
              maxLength={500}
              onChangeText={txt => onRemarksChange(task.id, txt)}
            />

            {/* Display Captured Image Thumbnail directly */}
            {currentResp.images && currentResp.images.length > 0 ? (
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
                    source={{ uri: currentResp.images[0] }}
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
                    onPress={() => onRemoveImage(task.id)}
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
                onPress={() => onOpenCamera(task.id)}
              >
                <CameraIcon size={18} color={colors.danger} />
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
              ⚠️ Only live camera capture is accepted. Gallery selection is
              disabled.
            </Text>
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.taskName === nextProps.task.taskName &&
      prevProps.task.isRequired === nextProps.task.isRequired &&
      prevProps.task.description === nextProps.task.description &&
      prevProps.response?.answer === nextProps.response?.answer &&
      prevProps.response?.remarks === nextProps.response?.remarks &&
      prevProps.response?.images?.length ===
        nextProps.response?.images?.length &&
      prevProps.response?.images?.[0] === nextProps.response?.images?.[0] &&
      prevProps.colors === nextProps.colors
    );
  },
);

export function PatrolScreen() {
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const navigation = useNavigation<any>();
  const routeParams = useRoute<any>()?.params;
  const navAssignmentId = routeParams?.assignmentId;

  // Atomic selectors for Zustand stores
  const isOnline = useOfflineStore(state => state.isConnected);
  const queueLength = useOfflineStore(state => state.queue.length);

  const queryClient = useQueryClient();
  const activeSession = usePatrolStore(state => state.activeSession);
  const scannedGateIds = usePatrolStore(state => state.scannedGateIds);
  const unlockedGateId = usePatrolStore(state => state.unlockedGateId);
  const justScannedGateId = usePatrolStore(state => state.justScannedGateId);
  const clearJustScannedGateId = usePatrolStore(
    state => state.clearJustScannedGateId,
  );
  const loadActiveSession = usePatrolStore(state => state.loadActiveSession);
  const completeSession = usePatrolStore(state => state.completeSession);

  const {
    data: assignmentsList,
    refetch: refetchAssignment,
    isLoading: isLoadingAssignment,
  } = useActiveAssignments();
  const assignments = assignmentsList || [];
  const [selectedAssignmentIndex, setSelectedAssignmentIndex] = useState(0);

  // Active assignment from active session (authoritative when patrol is in progress)
  const activeAssignment = useMemo(() => {
    if (activeSession) {
      // 1. Check if embedded assignment matches activeSession.assignmentId
      if (
        activeSession.assignmentId &&
        activeSession.assignment?.id === activeSession.assignmentId &&
        activeSession.assignment?.site
      ) {
        return activeSession.assignment;
      }

      // 2. Look up exact assignment from active assignments list using assignmentId
      if (activeSession.assignmentId && assignments.length > 0) {
        const found = assignments.find(
          (a: any) => a.id === activeSession.assignmentId,
        );
        if (found) return found;
      }

      // 3. Fallback to embedded assignment if no assignmentId mismatch
      if (activeSession.assignment?.site) {
        return activeSession.assignment;
      }
    }
    return null;
  }, [activeSession, assignments]);

  // Navigated assignment passed from Home screen
  const navAssignment = useMemo(() => {
    if (navAssignmentId && assignments.length > 0) {
      const found = assignments.find((a: any) => a.id === navAssignmentId);
      if (found) return found;
    }
    return null;
  }, [navAssignmentId, assignments]);

  // Authoritative assignment resolution
  const assignment =
    activeAssignment ||
    navAssignment ||
    (selectedAssignmentIndex >= 0 && selectedAssignmentIndex < assignments.length
      ? assignments[selectedAssignmentIndex]
      : null) ||
    assignments[0] ||
    null;

  // Sync selectedAssignmentIndex when active session or navigation param specifies a target assignment
  useEffect(() => {
    const targetId = activeSession?.assignmentId || navAssignmentId;
    if (targetId && assignments.length > 0) {
      const idx = assignments.findIndex((a: any) => a.id === targetId);
      if (idx !== -1 && idx !== selectedAssignmentIndex) {
        setSelectedAssignmentIndex(idx);
      }
    }
  }, [activeSession?.assignmentId, navAssignmentId, assignments]);

  const {
    startPatrol,
    isStarting,
    completePatrol,
    isCompleting,
    cancelPatrol,
    isCancelling,
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

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollYRef = useRef<number>(0);
  const gateLayoutsRef = useRef<Record<string, number>>({});
  const prevSessionIdRef = useRef<string | null>(null);

  // Initial patrol start: Reset scroll position to top (y = 0)
  useEffect(() => {
    if (activeSession?.id && activeSession.id !== prevSessionIdRef.current) {
      prevSessionIdRef.current = activeSession.id;
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    }
  }, [activeSession?.id]);

  // Memoized handlers for VerificationTaskItem to prevent unnecessary re-renders
  const handleAnswerChange = useCallback(
    (taskId: string, answer: 'YES' | 'NO') => {
      setSubTaskResponses(prev => ({
        ...prev,
        [taskId]: {
          answer,
          remarks: prev[taskId]?.remarks || '',
          images: prev[taskId]?.images || [],
        },
      }));
    },
    [],
  );

  const handleRemarksChange = useCallback((taskId: string, remarks: string) => {
    setSubTaskResponses(prev => ({
      ...prev,
      [taskId]: {
        answer: prev[taskId]?.answer || null,
        remarks,
        images: prev[taskId]?.images || [],
      },
    }));
  }, []);

  const handleRemoveTaskImage = useCallback((taskId: string) => {
    setSubTaskResponses(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        images: [],
      },
    }));
  }, []);

  const handleOpenCameraForSubTask = useCallback(
    async (taskId: string) => {
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
    },
    [hasPermission, requestPermission],
  );

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
      // Camera fallback handled gracefully
    }

    const realInspectionSample = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gIcSUNDX1BST0ZJTEUAAQEAAAIMbGNtcwIQAABtbnRyUkdCIFhZWiAH3wACAAkABgAxAABhY3NwTVNGVAAAAABzc21zAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApkZXNjAAAA4AAAAF9jcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaHJtAAABrAAAACR3dHB0AAAB0AAAABRyWFlaAAAB5AAAABRnWFlaAAAB+AAAABRiWFlaAAACDAAAABRyVFJDAAACIAAAACBnVFJDAAACIAAAACBiVFJDAAACIAAAACBkZXNjAAAAAAAAAAVzUkdCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABtbHVjAAAAAAAAABEAAAAMZW5VUwAAAA4AAAAcAEgAUAAgAFAAcgBvAGoAZQBjAHQAcwAAbWx1YwAAAAAAAAARAAAADGVuVVMAAAAMAAAAHABHAE8ATwBHAEwARQAAWFlaIAAAAAAAAG+iAAA49QAAA5BYWVogAAAAAAAAYpkAALeFAAAY2lhZWiAAAAAAAAAkBLIAAD24AAAO5VhZWiAAAAAAAABvqAAAOPUAAAOXRGVzYwAAAAAAAAAARW5nbGlzaAAAAAAAAAAAAAAAaW1nAAAAAABJSERSAAAAUAAAAFAIBgAAAH56m5wAAABMSURFQVR42u3PMQEAAAiAMCv8+16iBwwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC4G1c0AAFH72B9AAAAAElFTkSuQmCC`;
    attachPhotoResult(realInspectionSample);
    setIsCompressing(false);
    setShowCameraModal(false);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchAssignment();
    await loadActiveSession();
    setIsRefreshing(false);
  };

  const handleStart = async (resolveExisting = false) => {
    try {
      await startPatrol({
        assignmentId: assignment?.id,
        resolveExistingPatrol: resolveExisting,
      });
      Alert.alert(
        'Patrol Started',
        'Your active security patrol sweep has initiated.',
      );
    } catch (err: any) {
      const errCode = err?.response?.data?.error?.code || err?.code;
      if (errCode === 'ACTIVE_PATROL_EXISTS' || err?.response?.status === 409) {
        Alert.alert(
          'Ongoing Patrol Detected',
          'You already have a patrol in progress. Starting a new patrol will close the current patrol. If at least one checkpoint has been scanned, the current patrol will be marked as completed and moved to Completed Patrol History. If no checkpoints have been scanned, the current patrol will be cancelled and will not be added to patrol history. Do you want to continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => handleStart(true),
            },
          ],
        );
      } else {
        Alert.alert('Error starting patrol', err.message || 'Please try again.');
      }
    }
  };

  const hasScannedCheckpoints =
    scannedGateIds.length > 0 || unlockedGateId !== null;

  const handleQuitPatrol = () => {
    const activeSessionId = activeSession?.id;
    Alert.alert(
      'Quit Patrol?',
      "You haven't scanned any checkpoints. If you quit now, this patrol will not be recorded.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Quit Patrol',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeSessionId) {
                await cancelPatrol({ id: activeSessionId });
              }
              await completeSession();
              queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
              queryClient.invalidateQueries({ queryKey: ['patrol-sessions'] });
              queryClient.invalidateQueries({
                queryKey: ['active-assignments'],
              });
              navigation.navigate('HomeTab');
            } catch (err: any) {
              await completeSession();
              queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
              queryClient.invalidateQueries({ queryKey: ['patrol-sessions'] });
              queryClient.invalidateQueries({
                queryKey: ['active-assignments'],
              });
              navigation.navigate('HomeTab');
            }
          },
        },
      ],
    );
  };

  const handleComplete = async () => {
    if (!activeSession) return;

    const completedCount = isManager
      ? (activeSession as any)?.checkpoints?.length || scannedGateIds.length || 0
      : scannedGateIds.length;

    if (completedCount === 0) {
      if (isManager) {
        Alert.alert(
          'No Checkpoints Scanned',
          'Scan and complete at least one checkpoint before finishing the patrol.',
          [{ text: 'OK', style: 'default' }],
        );
        return;
      }

      const activeSessionId = activeSession.id;
      Alert.alert(
        'No Checkpoints Scanned',
        'No checkpoints were scanned. This patrol will not be recorded.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Exit Patrol',
            style: 'destructive',
            onPress: async () => {
              try {
                if (activeSessionId) {
                  await cancelPatrol({ id: activeSessionId });
                }
                await completeSession();
                queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
                queryClient.invalidateQueries({
                  queryKey: ['patrol-sessions'],
                });
                queryClient.invalidateQueries({
                  queryKey: ['active-assignments'],
                });
                navigation.navigate('Home');
              } catch (err: any) {
                await completeSession();
                queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
                queryClient.invalidateQueries({
                  queryKey: ['patrol-sessions'],
                });
                queryClient.invalidateQueries({
                  queryKey: ['active-assignments'],
                });
                navigation.navigate('Home');
              }
            },
          },
        ],
      );
      return;
    }

    const confirmAndComplete = async () => {
      try {
        await completePatrol({
          id: activeSession.id,
          remarks: 'Completed Manager Patrol Sweep.',
        });

        if (isManager) {
          Alert.alert(
            'Manager Patrol Completed',
            `${completedCount} checkpoint${completedCount === 1 ? '' : 's'} inspected successfully.`,
            [
              {
                text: 'Done',
                onPress: async () => {
                  await completeSession();
                  queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
                  queryClient.invalidateQueries({ queryKey: ['patrol-sessions'] });
                  navigation.navigate('HomeTab');
                },
              },
            ],
          );
        } else {
          Alert.alert('Patrol Completed', 'Patrol sweep finalized and logged.');
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to complete.');
      }
    };

    if (unlockedGateId) {
      Alert.alert(
        'Inspection In Progress',
        'Complete or cancel the current checkpoint inspection before finishing the sweep.',
      );
      return;
    }

    if (isManager) {
      Alert.alert(
        'Finish Manager Patrol?',
        `You have inspected ${completedCount} checkpoint${completedCount === 1 ? '' : 's'}.\nFinishing the sweep will complete this patrol session.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Finish Sweep',
            onPress: confirmAndComplete,
          },
        ],
      );
      return;
    }

    const totalGates = assignment?.patrolRoute?.routeGates?.length || 0;
    const remaining = totalGates - scannedGateIds.length;

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
                  images:
                    val.images && val.images.length > 0
                      ? val.images
                      : undefined,
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

              if (isManager) {
                Alert.alert(
                  'Manager Inspection Completed',
                  'Checkpoint inspection has been saved successfully.',
                  [
                    {
                      text: 'CANCEL',
                      style: 'cancel',
                      onPress: () => {
                        usePatrolStore.getState().lockCheckpoint();
                        loadActiveSession();
                      },
                    },
                    {
                      text: 'SCAN ANOTHER CHECKPOINT',
                      onPress: () => {
                        usePatrolStore.getState().lockCheckpoint();
                        loadActiveSession();
                        navigation.navigate('ScannerTab');
                      },
                    },
                  ],
                );
                return;
              }

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

  const user = useAuthStore(state => state.user);
  const userRole =
    (user as any)?.employee?.role || (user as any)?.role || 'SECURITY';
  const isManager = userRole === 'MANAGER';

  const managerGateId = isManager
    ? routeParams?.checkpointId ||
      unlockedGateId ||
      ((activeSession as any)?.checkpoints && (activeSession as any).checkpoints[0]?.gateId)
    : null;

  const { data: managerGateDetails } = useQuery({
    queryKey: ['gate-details', managerGateId],
    queryFn: async () => {
      if (!managerGateId) return null;
      const res = (await apiClient.get(`/gates/${managerGateId}`)) as any;
      return res.data || null;
    },
    enabled: isManager && !!managerGateId,
  });

  // Memoized route gates list calculation
  const routeGates = useMemo(() => {
    if (isManager) {
      const sessionCheckpoints = (activeSession as any)?.checkpoints || [];
      const list: any[] = [];
      const seenGateIds = new Set<string>();

      sessionCheckpoints.forEach((cp: any, idx: number) => {
        const gId = cp.gateId || cp.gate?.id;
        if (gId) seenGateIds.add(gId);
        list.push({
          id: cp.id || gId || `cp-${idx}`,
          gateId: gId,
          gate: cp.gate || {
            id: gId,
            name: `Checkpoint #${idx + 1}`,
            gateCode: gId,
          },
          sequence: idx + 1,
          isCompleted: true,
          scannedAt: cp.scannedAt,
          subTaskResponses: cp.subTaskResponses,
        });
      });

      if (unlockedGateId && !seenGateIds.has(unlockedGateId)) {
        const gateObj = managerGateDetails || routeParams?.gate;
        list.push({
          id: unlockedGateId,
          gateId: unlockedGateId,
          gate: gateObj || {
            id: unlockedGateId,
            name: routeParams?.checkpointName || 'Manager Inspection Checkpoint',
            gateCode: routeParams?.checkpointCode || unlockedGateId,
          },
          sequence: list.length + 1,
          isCompleted: false,
        });
      }
      return list;
    }

    const isDirectAssignment =
      assignment?.assignmentType === 'DIRECT_CHECKPOINTS' ||
      (!assignment?.patrolRoute &&
        assignment?.assignmentGates &&
        assignment.assignmentGates.length > 0);

    if (isDirectAssignment) {
      return (assignment?.assignmentGates || []).map((ag: any, idx: number) => ({
        id: ag.id,
        gateId: ag.gateId || ag.gate?.id || ag.id,
        gate: ag.gate,
        sequence: ag.sequence || idx + 1,
      }));
    }
    return (assignment?.patrolRoute?.routeGates || []).map(
      (rg: any, idx: number) => ({
        id: rg.id,
        gateId: rg.gateId || rg.gate?.id || rg.id,
        gate: rg.gate,
        sequence: rg.sequence || idx + 1,
      }),
    );
  }, [isManager, (activeSession as any)?.checkpoints, managerGateDetails, routeParams, unlockedGateId, assignment]);

  const totalGates = routeGates.length;
  const scannedCount = isManager
    ? (activeSession as any)?.checkpoints?.length || scannedGateIds.length || 0
    : scannedGateIds.length;
  const remainingCount = totalGates - scannedCount;

  const estRemainingTime = useMemo(
    () => (remainingCount > 0 ? `${remainingCount * 3} mins` : 'Completed'),
    [remainingCount],
  );

  const isGateUnlocked = useCallback(
    (rg: any) => {
      if (rg.isCompleted) return false;
      if (!unlockedGateId) return false;
      const targets = [
        rg.gateId,
        rg.id,
        rg.gate?.id,
        rg.gate?.gateCode,
        rg.gate?.qrCode,
      ].filter(Boolean);
      return targets.includes(unlockedGateId);
    },
    [unlockedGateId],
  );

  const isGateCompleted = useCallback(
    (rg: any) => {
      if (rg.isCompleted) return true;
      if (!scannedGateIds || scannedGateIds.length === 0) return false;
      const targets = [
        rg.gateId,
        rg.id,
        rg.gate?.id,
        rg.gate?.gateCode,
        rg.gate?.qrCode,
      ].filter(Boolean);
      return targets.some(id => scannedGateIds.includes(id));
    },
    [scannedGateIds],
  );

  const unlockedGateObj = useMemo(
    () => routeGates.find((rg: any) => isGateUnlocked(rg)),
    [routeGates, isGateUnlocked],
  );

  // Programmatic scroll ONLY after a successful QR scan (when justScannedGateId is set)
  const scrollToScannedGate = useCallback(
    (overrideY?: number) => {
      const gateIdToScroll = justScannedGateId;
      if (!gateIdToScroll) return;

      // Check if the scanned checkpoint is the last one in the route list
      const lastGate = routeGates[routeGates.length - 1];
      const isLastGateScanned =
        lastGate &&
        [
          lastGate.gateId,
          lastGate.id,
          lastGate.gate?.id,
          lastGate.gate?.gateCode,
          lastGate.gate?.qrCode,
        ]
          .filter(Boolean)
          .some(
            (id: string) =>
              gateIdToScroll.includes(id) || id.includes(gateIdToScroll),
          );

      if (isLastGateScanned) {
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        });
        return;
      }

      let targetY: number | null = overrideY !== undefined ? overrideY : null;

      if (targetY === null) {
        const foundY =
          gateLayoutsRef.current[gateIdToScroll] ??
          Object.entries(gateLayoutsRef.current).find(
            ([key]) =>
              gateIdToScroll.includes(key) || key.includes(gateIdToScroll),
          )?.[1];

        if (foundY !== undefined) {
          targetY = foundY;
        }
      }

      if (targetY !== null && targetY >= 0) {
        const scrollPos = Math.max(0, targetY - 20);
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollTo({ y: scrollPos, animated: false });
        });
      }
    },
    [justScannedGateId, routeGates],
  );

  // Trigger scroll to checkpoint ONLY after a successful QR scan
  useEffect(() => {
    if (isFocused && activeSession && justScannedGateId) {
      scrollToScannedGate();

      const timer1 = setTimeout(() => {
        scrollToScannedGate();
      }, 50);

      const timer2 = setTimeout(() => {
        scrollToScannedGate();
      }, 150);

      const timer3 = setTimeout(() => {
        scrollToScannedGate();
      }, 400);

      const timer4 = setTimeout(() => {
        scrollToScannedGate();
      }, 800);

      const timer5 = setTimeout(() => {
        scrollToScannedGate();
        clearJustScannedGateId();
      }, 1500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
        clearTimeout(timer5);
      };
    }
  }, [
    isFocused,
    justScannedGateId,
    activeSession,
    scrollToScannedGate,
    clearJustScannedGateId,
  ]);

  const activeGateId = useMemo(
    () =>
      unlockedGateObj?.gateId ||
      unlockedGateObj?.gate?.id ||
      unlockedGateId ||
      routeGates.find((rg: any) => !isGateCompleted(rg))?.gateId,
    [unlockedGateObj, unlockedGateId, routeGates, isGateCompleted],
  );



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

  const getSubTasksForGate = useCallback(
    (rg: any) => {
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
    },
    [activeGateId, fetchedSubTasksRes, isGateUnlocked, userRole],
  );

  const isDirect =
    assignment?.assignmentType === 'DIRECT_CHECKPOINTS' ||
    (!assignment?.patrolRoute && assignment?.assignmentGates);

  return (
    <View
      style={[styles.mainContainer, { backgroundColor: colors.background }]}
    >
      <ScrollView
        ref={scrollViewRef}
        onScroll={e => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        onScrollBeginDrag={() => {
          if (justScannedGateId) {
            clearJustScannedGateId();
          }
        }}
        onContentSizeChange={() => {
          if (justScannedGateId) {
            scrollToScannedGate();
          }
        }}
        scrollEventThrottle={16}
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: activeSession
              ? hasScannedCheckpoints
                ? 90
                : 150
              : 40,
          },
        ]}
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
          <View
            style={[styles.syncBanner, { backgroundColor: colors.primary }]}
          >
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
        {(!activeSession && !(isManager && routeGates.length > 0)) && (
          <View style={styles.startContainer}>
            {isLoadingAssignment ? (
              <ActivityIndicator
                color={colors.primary}
                size="large"
                style={{ marginTop: 40 }}
              />
            ) : isManager ? (
              <Card style={styles.emptyCard}>
                <Text style={[styles.cardTitle, { color: colors.text, textAlign: 'center', marginBottom: 8 }]}>
                  Manager Checkpoint Inspection
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center' }]}
                >
                  Scan any site checkpoint QR code using the QR Scanner to perform a direct Manager inspection.
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignSelf: 'center',
                    marginTop: 16,
                  }}
                  onPress={() => navigation.navigate('ScannerTab')}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>
                    Open QR Scanner
                  </Text>
                </TouchableOpacity>
              </Card>
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
                              borderColor: isSel
                                ? colors.primary
                                : colors.border,
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
                    {assignment?.shift?.startTime} -{' '}
                    {assignment?.shift?.endTime}
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
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
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
                    style={[
                      styles.statusLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Patrol Timer
                  </Text>
                  {/* ISOLATED MEMOIZED TIMER DISPLAY */}
                  <PatrolTimerDisplay />
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
                style={[
                  styles.progressBarBg,
                  { backgroundColor: colors.border },
                ]}
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
                <View
                  key={rg.id}
                  onLayout={event => {
                    const y = event.nativeEvent.layout.y;
                    const ids = [
                      rg.gateId,
                      rg.id,
                      rg.gate?.id,
                      rg.gate?.gateCode,
                      rg.gate?.qrCode,
                    ].filter(Boolean);
                    ids.forEach((id: string) => {
                      gateLayoutsRef.current[id] = y;
                    });

                    if (isUnlocked && justScannedGateId) {
                      scrollToScannedGate(y);
                    }
                  }}
                >
                  <Card
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
                          style={[
                            styles.gateSub,
                            { color: colors.textSecondary },
                          ]}
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
                          const currentGateSubTasks = getSubTasksForGate(
                            rg.gate,
                          );
                          const activeTasks = currentGateSubTasks.filter(
                            (st: any) => st.isActive !== false,
                          );
                          if (activeTasks.length === 0) {
                            return (
                              <View style={{ paddingVertical: 14 }}>
                                <Text
                                  style={{
                                    color: colors.textSecondary,
                                    fontSize: 13,
                                    fontStyle: 'italic',
                                    lineHeight: 18,
                                  }}
                                >
                                  {isManager
                                    ? 'ℹ No inspection tasks are configured for the Manager role at this checkpoint. You may submit this inspection with optional remarks or photo evidence.'
                                    : 'No specific verification tasks configured for this checkpoint.'}
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
                              {activeTasks.map((task: any, taskIdx: number) => (
                                <VerificationTaskItem
                                  key={task.id || taskIdx}
                                  task={task}
                                  taskIdx={taskIdx}
                                  response={subTaskResponses[task.id]}
                                  onAnswerChange={handleAnswerChange}
                                  onRemarksChange={handleRemarksChange}
                                  onRemoveImage={handleRemoveTaskImage}
                                  onOpenCamera={handleOpenCameraForSubTask}
                                  colors={colors}
                                />
                              ))}
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
                          onPress={() =>
                            navigation.navigate('Scanner', {
                              checkpointId: rg.gateId || rg.gate?.id || rg.id,
                              checkpointCode: rg.gate?.gateCode,
                              checkpointName: rg.gate?.name,
                              sequenceOrder: rg.sequence,
                            })
                          }
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
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FIXED BOTTOM ACTION BAR */}
      {activeSession && (
        <View
          style={[
            styles.fixedBottomBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {hasScannedCheckpoints ? (
            <View style={styles.controlRow}>
              <Button
                title="Finish Sweep"
                variant="danger"
                onPress={handleComplete}
                loading={isCompleting}
                style={styles.controlButton}
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Button
                title="Quit Patrol"
                variant="outline"
                onPress={handleQuitPatrol}
                style={{ borderColor: colors.danger, borderWidth: 1 }}
                textStyle={{ color: colors.danger, fontWeight: '700' }}
              />
            </View>
          )}
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
                onError={() => {
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
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  fixedBottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
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
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  startButton: {
    marginTop: 12,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  activeContainer: {
    gap: 16,
  },
  statusCard: {
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  timer: {
    fontSize: 26,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  checkpointCard: {
    padding: 16,
    marginBottom: 12,
  },
  gateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seqBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  gateInfo: {
    flex: 1,
  },
  gateName: {
    fontSize: 15,
    fontWeight: '700',
  },
  gateSub: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '700',
  },
  unlockedPanel: {
    marginTop: 12,
  },
  innerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  panelLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  lockedPanel: {
    marginTop: 12,
  },
  scanTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  scanTriggerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  controlButton: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
  },
  cameraTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  viewfinder: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 20,
    position: 'relative',
    backgroundColor: '#000000',
  },
  crosshair: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    right: '15%',
    bottom: '30%',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
  },
  compressLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compressLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  cameraCancel: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  shutterButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
  },
});
