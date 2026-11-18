import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { useRunOnJS } from 'react-native-worklets-core';
import { useTheme } from '../../../app/hooks/useTheme';
import { FaceGuideOverlay } from '../components/FaceGuideOverlay';
import { FaceQualityValidator, FaceDetectionData } from '../engine/face-quality';
import { FaceLivenessValidator } from '../engine/face-liveness';
import { FaceVerificationEngine, FaceVerificationResult } from '../engine/face-verification-engine';
import { faceModelManager } from '../engine/face-model-manager';
import { secureFaceCache, SecureFaceCachePayload } from '../services/secure-face-cache';
import { faceEnrollmentApi } from '../api/face-enrollment.api';
import { useAuthStore } from '../../../app/store/auth-store';
import { ArrowLeft, CheckCircle2, XCircle, Shield } from 'lucide-react-native';
import { useAttendanceStore } from '../../attendance/store/attendance-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import { useActiveAssignments } from '../../assignment/hooks/useAssignment';
import { useManagerStore } from '../../manager/store/manager-store';
import { getEmployeeDisplayName } from '../../../app/utils/user-helpers';
import { patrolApi } from '../../patrol/api/patrol.api';
import { usePatrolStore } from '../../patrol/store/patrol-store';

export function FaceVerificationScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const isConnected = useOfflineStore((state) => state.isConnected);
  const device = useCameraDevice('front');
  const [hasPermission, setHasPermission] = useState(false);
  const [referenceTemplate, setReferenceTemplate] = useState<number[] | null>(null);
  const [cacheMeta, setCacheMeta] = useState<SecureFaceCachePayload | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [verificationState, setVerificationState] = useState<'SEARCHING' | 'MATCH' | 'NO_MATCH'>('SEARCHING');
  const [statusMessage, setStatusMessage] = useState('Position your face in the oval');

  const mode = route?.params?.mode || 'VERIFY_ONLY';
  const passedAssignment = route?.params?.assignment;
  const checkpointParams = route?.params?.checkpointParams;
  const patrolParams = route?.params?.patrolParams;

  const { data: assignmentsList } = useActiveAssignments();
  const activeAssignment = passedAssignment || (assignmentsList && assignmentsList.length > 0 ? assignmentsList[0] : null);

  const livenessValidatorRef = useRef<FaceLivenessValidator>(new FaceLivenessValidator());
  const isVerifyingRef = useRef(false);
  const isStartingPatrolRef = useRef(false);
  const isFrameBusyRef = useRef(false);
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();

    // Pre-warm ONNX session on screen mount to eliminate cold-start latency
    faceModelManager.initSession().catch((err) => {
      console.warn('[FaceVerificationScreen] ONNX session pre-warm warning:', err?.message || err);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const empId = user?.employeeId || (user as any)?.employee?.id;
      const clientId =
        (user as any)?.clientId ||
        (user as any)?.employee?.clientId ||
        useManagerStore.getState().activeClient?.clientId ||
        '';

      if (!user?.id || !empId) {
        setLoadingTemplate(false);
        return;
      }

      // Reset liveness challenge on screen mount
      livenessValidatorRef.current.startChallenge('BLINK');

      // 1. Check server status if connected to prevent stale cache after reset
      try {
        const serverStatus = await faceEnrollmentApi.getStatus();
        if (serverStatus?.status !== 'REGISTERED') {
          await secureFaceCache.clearSecureCache();
          setReferenceTemplate(null);
          setCacheMeta(null);
          setLoadingTemplate(false);
          return;
        }
      } catch (err) {
        console.warn('[FaceVerificationScreen] Online status check fallback to local cache:', err);
      }

      // 2. Read from encrypted local cache
      const localCache = await secureFaceCache.getSecureCache(user.id, empId);
      if (localCache && localCache.template) {
        setReferenceTemplate(localCache.template);
        setCacheMeta(localCache);
        setLoadingTemplate(false);
        return;
      }

      // 3. Hydrate from server API if local cache missing
      try {
        const serverData = await faceEnrollmentApi.getTemplate();
        if (serverData && serverData.template) {
          setReferenceTemplate(serverData.template);
          await secureFaceCache.saveSecureCache(user.id, empId, clientId, {
            template: serverData.template,
            modelName: serverData.modelName,
            modelVersion: serverData.modelVersion,
            embeddingDimension: serverData.embeddingDimension,
            registeredAt: serverData.registeredAt,
          });
          setCacheMeta({
            ownerUserId: user.id,
            ownerEmployeeId: empId,
            ownerClientId: clientId,
            modelName: serverData.modelName,
            modelVersion: serverData.modelVersion,
            embeddingDimension: serverData.embeddingDimension,
            template: serverData.template,
            registeredAt: serverData.registeredAt,
          });
        }
      } catch (err) {
        console.warn('[FaceVerificationScreen] Could not fetch server template:', err);
      } finally {
        setLoadingTemplate(false);
      }
    })();
  }, [user]);

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    contourMode: 'none',
    landmarkMode: 'all',
    classificationMode: 'all',
    minFaceSize: 0.15,
  });

  const processVerification = useCallback(
    async (faces: any[], imageWidth: number, imageHeight: number) => {
      if (isVerifyingRef.current || !referenceTemplate || verificationState !== 'SEARCHING') {
        return;
      }

      const mappedFaces: FaceDetectionData[] = (faces || []).map((f) => ({
        bounds: f.bounds || { x: f.frame?.x || 0, y: f.frame?.y || 0, width: f.frame?.width || 0, height: f.frame?.height || 0 },
        rollAngle: f.rollAngle,
        pitchAngle: f.pitchAngle,
        yawAngle: f.yawAngle,
        leftEyeOpenProbability: f.leftEyeOpenProbability,
        rightEyeOpenProbability: f.rightEyeOpenProbability,
        landmarks: f.landmarks,
        contours: f.contours,
      }));

      // 1. Face Quality Validation
      const quality = FaceQualityValidator.validate(mappedFaces, imageWidth, imageHeight);
      if (!quality.valid) {
        setStatusMessage(quality.message);
        return;
      }

      const candidateFace = mappedFaces[0];

      // 2. Active Liveness Challenge (Blink)
      const livenessStatus = livenessValidatorRef.current.processFrame(candidateFace);
      if (!livenessStatus.isCompleted) {
        setStatusMessage(livenessStatus.instructions || 'Blink your eyes to verify liveness');
        return;
      }

      // Lock verification to prevent concurrent frame evaluation
      isVerifyingRef.current = true;
      setStatusMessage('Verifying identity...');

      const empId = user?.employeeId || (user as any)?.employee?.id || 'UNKNOWN';
      let evaluation: FaceVerificationResult;
      try {
        const photo = await cameraRef.current?.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });

        if (photo?.path) {
          evaluation = await FaceVerificationEngine.evaluatePhotoAsync(
            photo.path,
            {
              userId: user?.id || '',
              employeeId: empId,
              referenceTemplate,
              templateVersion: cacheMeta?.modelVersion || 'v2',
              customThreshold: FaceVerificationEngine.DEFAULT_MATCH_THRESHOLD,
              livenessPassed: true,
            },
          );
        } else {
          throw new Error('Photo capture returned empty path');
        }
      } catch (photoErr: any) {
        console.warn('[FaceVerificationScreen] Photo capture or evaluation error:', photoErr?.message || photoErr);
        isVerifyingRef.current = false;
        setStatusMessage('Hold still and look directly at camera');
        return;
      }

      if (evaluation.status === 'FACE_VERIFIED') {
        if (mode === 'MARK_ATTENDANCE') {
          const empName = getEmployeeDisplayName(user);
          const asgId = activeAssignment?.id || useAttendanceStore.getState().todayAttendance?.assignmentId || 'direct';
          const stId = activeAssignment?.site?.id || activeAssignment?.siteId || '';
          const stName = activeAssignment?.site?.name || 'Direct Check-In';
          const shId = activeAssignment?.shift?.id || activeAssignment?.shiftId || '';
          const shName = activeAssignment?.shift?.name || 'General Shift';
          const shStart = activeAssignment?.shift?.startTime || '—';
          const shEnd = activeAssignment?.shift?.endTime || '—';
          const desig = (user as any)?.employee?.designation || (user as any)?.role || 'Security Guard';

          await useAttendanceStore.getState().markAttendance({
            employeeId: empId,
            employeeName: empName,
            assignmentId: asgId,
            siteId: stId,
            siteName: stName,
            shiftId: shId,
            shiftName: shName,
            shiftStartTime: shStart,
            shiftEndTime: shEnd,
            designation: desig,
            isConnected,
          });

          setVerificationState('MATCH');
          setStatusMessage('✓ Face Verified — Attendance Marked');

          setTimeout(() => {
            navigation.goBack();
          }, 1400);
        } else if (mode === 'MARK_CHECKOUT') {
          const asgId = activeAssignment?.id || useAttendanceStore.getState().todayAttendance?.assignmentId || 'direct';

          await useAttendanceStore.getState().markCheckOut({
            employeeId: empId,
            assignmentId: asgId,
            isConnected,
          });

          setVerificationState('MATCH');
          setStatusMessage('✓ Face Verified — Checked Out');

          setTimeout(() => {
            navigation.goBack();
          }, 1400);
        } else if (mode === 'START_PATROL') {
          if (isStartingPatrolRef.current) return;
          isStartingPatrolRef.current = true;

          setVerificationState('MATCH');
          setStatusMessage('✓ Face Verified — Authorizing Patrol...');

          try {
            const assignmentId = patrolParams?.assignmentId || activeAssignment?.id;
            if (!assignmentId) {
              throw new Error('No patrol assignment selected.');
            }

            // Step 1: Request short-lived single-use face auth token from backend
            const authRes = await patrolApi.authorizeStartPatrol(assignmentId);
            const faceAuthToken = authRes?.faceAuthToken;

            // Step 2: Start patrol session with server token verification
            const started = await patrolApi.startPatrol(
              assignmentId,
              patrolParams?.resolveExistingPatrol,
              undefined,
              faceAuthToken,
            );

            // Step 3: Populate active session in local store
            await usePatrolStore.getState().startSession(started);

            setStatusMessage('✓ Patrol Started Successfully');

            setTimeout(() => {
              navigation.replace('Dashboard', {
                screen: 'PatrolTab',
                params: {
                  assignmentId,
                  sessionId: started.id,
                },
              });
            }, 800);
          } catch (err: any) {
            console.error('[FaceVerificationScreen] Patrol start error:', err);
            isStartingPatrolRef.current = false;
            const errCode = err?.response?.data?.error?.code || err?.code;
            if (errCode === 'ACTIVE_PATROL_EXISTS' || err?.response?.status === 409) {
              Alert.alert(
                'Ongoing Patrol Detected',
                'You already have a patrol in progress. Starting a new patrol will close the current patrol. If at least one checkpoint has been scanned, the current patrol will be marked as completed and moved to Completed Patrol History. If no checkpoints have been scanned, the current patrol will be cancelled and will not be added to patrol history. Do you want to continue?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => navigation.goBack(),
                  },
                  {
                    text: 'Continue',
                    onPress: async () => {
                      try {
                        const asgId = patrolParams?.assignmentId || activeAssignment?.id;
                        const authRes = await patrolApi.authorizeStartPatrol(asgId);
                        const started = await patrolApi.startPatrol(
                          asgId,
                          true,
                          undefined,
                          authRes?.faceAuthToken,
                        );
                        await usePatrolStore.getState().startSession(started);
                        navigation.replace('Dashboard', {
                          screen: 'PatrolTab',
                          params: {
                            assignmentId: asgId,
                            sessionId: started.id,
                          },
                        });
                      } catch (e: any) {
                        Alert.alert('Error', e.message || 'Failed to start patrol.');
                        navigation.goBack();
                      }
                    },
                  },
                ],
              );
            } else {
              setVerificationState('NO_MATCH');
              setStatusMessage(
                err?.response?.data?.message ||
                  err?.message ||
                  'Failed to start patrol. Please retry.',
              );
            }
          }
        } else if (mode === 'CHECKPOINT_UNLOCK') {
          setVerificationState('MATCH');
          setStatusMessage('✓ Face Verified — Opening Scanner...');

          setTimeout(() => {
            navigation.replace('Scanner', checkpointParams || {});
          }, 800);
        } else {
          setVerificationState('MATCH');
          setStatusMessage('✓ Face Verified Successfully');
        }
      } else if (evaluation.status === 'FACE_QUALITY_FAILED') {
        // Face quality or alignment issue: do NOT fail verification with Score: 0.00!
        // Keep searching smoothly and guide the user
        isVerifyingRef.current = false;
        setStatusMessage(evaluation.message || 'Hold still and look directly at camera');
        return;
      } else if (evaluation.status === 'LIVENESS_FAILED') {
        isVerifyingRef.current = false;
        livenessValidatorRef.current.startChallenge('BLINK');
        setStatusMessage('Blink your eyes to verify liveness');
        return;
      } else if (evaluation.status === 'TEMPLATE_VERSION_UNSUPPORTED') {
        setVerificationState('NO_MATCH');
        setStatusMessage('Your face registration needs to be updated. Please re-register.');
      } else if (evaluation.status === 'TEMPLATE_UNAVAILABLE') {
        setVerificationState('NO_MATCH');
        setStatusMessage('No face template found. Please register your face first.');
      } else {
        // Genuine 1:1 Face Not Matched with actual similarity score
        const score = evaluation.status === 'FACE_NOT_MATCHED' ? evaluation.similarity.toFixed(2) : '0.00';
        setVerificationState('NO_MATCH');
        setStatusMessage(`Face Not Matched (Score: ${score}). Identity verification failed.`);
      }
    },
    [referenceTemplate, verificationState, user, cacheMeta, mode, activeAssignment, isConnected, navigation, checkpointParams, patrolParams],
  );

  const handleFrameProcessed = useRunOnJS(
    (faces: any[], width: number, height: number) => {
      if (isFrameBusyRef.current || isVerifyingRef.current || verificationState !== 'SEARCHING') {
        return;
      }
      isFrameBusyRef.current = true;
      processVerification(faces, width, height)
        .catch((err) => {
          console.warn('[FaceVerificationScreen] Process frame error:', err);
        })
        .finally(() => {
          isFrameBusyRef.current = false;
        });
    },
    [processVerification, verificationState],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const faces = detectFaces(frame);
      if (!faces || faces.length === 0) {
        handleFrameProcessed([], frame.width, frame.height);
        return;
      }

      const safeFaces = [];
      for (let i = 0; i < faces.length; i++) {
        const f = faces[i];
        safeFaces.push({
          bounds: f.bounds,
          rollAngle: f.rollAngle,
          pitchAngle: f.pitchAngle,
          yawAngle: f.yawAngle,
          leftEyeOpenProbability: f.leftEyeOpenProbability,
          rightEyeOpenProbability: f.rightEyeOpenProbability,
          landmarks: f.landmarks,
          contours: undefined,
        });
      }
      handleFrameProcessed(safeFaces, frame.width, frame.height);
    },
    [detectFaces, handleFrameProcessed],
  );

  const handleRetry = () => {
    isVerifyingRef.current = false;
    isFrameBusyRef.current = false;
    isStartingPatrolRef.current = false;
    livenessValidatorRef.current.startChallenge('BLINK');
    setVerificationState('SEARCHING');
    setStatusMessage('Position your face in the oval');
  };

  if (!hasPermission || !device) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>Camera unavailable or permission denied</Text>
      </View>
    );
  }

  if (loadingTemplate) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading face verification profile...</Text>
      </View>
    );
  }

  if (!referenceTemplate) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>No face profile registered</Text>
        <Text style={[styles.subText, { color: colors.textSecondary }]}>Please register your face first.</Text>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.actionBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {mode === 'CHECKPOINT_UNLOCK'
            ? 'Checkpoint Face Gate'
            : mode === 'START_PATROL'
            ? 'Start Patrol Verification'
            : 'Face Verification'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Start Patrol Context Banner */}
      {mode === 'START_PATROL' && (
        <View style={[styles.checkpointBanner, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Shield size={18} color={colors.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.checkpointBannerTitle, { color: colors.text }]}>
              Verify your face to start patrol
            </Text>
            <Text style={[styles.checkpointBannerSub, { color: colors.textSecondary }]}>
              Face verification is required once to begin your patrol session.
            </Text>
          </View>
        </View>
      )}

      {/* Checkpoint Unlock Context Banner */}
      {mode === 'CHECKPOINT_UNLOCK' && (
        <View style={[styles.checkpointBanner, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Shield size={18} color={colors.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.checkpointBannerTitle, { color: colors.text }]}>
              Verify your face to unlock this checkpoint
            </Text>
            <Text style={[styles.checkpointBannerSub, { color: colors.textSecondary }]}>
              Face verification is required before scanning the checkpoint QR.
            </Text>
          </View>
        </View>
      )}

      {/* Camera Preview */}
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={verificationState === 'SEARCHING'}
          frameProcessor={frameProcessor}
          photo={true}
          pixelFormat="yuv"
        />
        <FaceGuideOverlay
          statusColor={
            verificationState === 'MATCH'
              ? '#10B981'
              : verificationState === 'NO_MATCH'
              ? '#EF4444'
              : colors.primary
          }
        />

        {/* Verification Result Banner */}
        <View
          style={[
            styles.banner,
            verificationState === 'MATCH' && styles.bannerSuccess,
            verificationState === 'NO_MATCH' && styles.bannerDanger,
          ]}
        >
          {verificationState === 'MATCH' ? (
            <CheckCircle2 size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : verificationState === 'NO_MATCH' ? (
            <XCircle size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : null}
          <Text style={styles.bannerText}>{statusMessage}</Text>
        </View>
      </View>

      {/* Retry Button on mismatch */}
      {verificationState !== 'SEARCHING' ? (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleRetry}>
            <Text style={styles.actionBtnText}>Test Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  banner: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSuccess: {
    backgroundColor: '#10B981',
  },
  bannerDanger: {
    backgroundColor: '#EF4444',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  footer: {
    padding: 20,
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  checkpointBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  checkpointBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  checkpointBannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
