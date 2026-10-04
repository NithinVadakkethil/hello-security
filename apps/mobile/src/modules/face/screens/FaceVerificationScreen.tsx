import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { useRunOnJS } from 'react-native-worklets-core';
import { useTheme } from '../../../app/hooks/useTheme';
import { FaceGuideOverlay } from '../components/FaceGuideOverlay';
import { FaceQualityValidator, FaceDetectionData } from '../engine/face-quality';
import { FaceLivenessValidator } from '../engine/face-liveness';
import { FaceVerificationEngine, FaceVerificationResult } from '../engine/face-verification-engine';
import { secureFaceCache, SecureFaceCachePayload } from '../services/secure-face-cache';
import { faceEnrollmentApi } from '../api/face-enrollment.api';
import { useAuthStore } from '../../../app/store/auth-store';
import { ArrowLeft, CheckCircle2, XCircle, Shield } from 'lucide-react-native';
import { useAttendanceStore } from '../../attendance/store/attendance-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import { useActiveAssignments } from '../../assignment/hooks/useAssignment';
import { getEmployeeDisplayName } from '../../../app/utils/user-helpers';

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

  const { data: assignmentsList } = useActiveAssignments();
  const activeAssignment = passedAssignment || (assignmentsList && assignmentsList.length > 0 ? assignmentsList[0] : null);

  const livenessValidatorRef = useRef<FaceLivenessValidator>(new FaceLivenessValidator());
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const empId = user?.employeeId || (user as any)?.employee?.id;
      const clientId = (user as any)?.clientId || (user as any)?.employee?.clientId || '';

      if (!user?.id || !empId) {
        setLoadingTemplate(false);
        return;
      }

      // Reset liveness challenge on screen mount
      livenessValidatorRef.current.startChallenge('BLINK');

      // 1. Try reading from encrypted local cache
      const localCache = await secureFaceCache.getSecureCache(user.id, empId);
      if (localCache && localCache.template) {
        setReferenceTemplate(localCache.template);
        setCacheMeta(localCache);
        setLoadingTemplate(false);
        return;
      }

      // 2. Hydrate from server API if local cache missing
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
    performanceMode: 'accurate',
    contourMode: 'all',
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
      const evaluation: FaceVerificationResult = await FaceVerificationEngine.evaluateFrameAsync(
        mappedFaces,
        imageWidth,
        imageHeight,
        {
          userId: user?.id || '',
          employeeId: empId,
          referenceTemplate,
          templateVersion: cacheMeta?.modelVersion || 'v2',
          customThreshold: FaceVerificationEngine.DEFAULT_MATCH_THRESHOLD,
          livenessPassed: true,
        },
      );

      if (evaluation.status === 'FACE_VERIFIED') {
        if (mode === 'MARK_ATTENDANCE') {
          const empName = getEmployeeDisplayName(user);
          const asgId = activeAssignment?.id || 'default_asg';
          const stId = activeAssignment?.site?.id || activeAssignment?.siteId || 'default_site';
          const stName = activeAssignment?.site?.name || 'Assigned Site';
          const shId = activeAssignment?.shift?.id || activeAssignment?.shiftId || 'default_shift';
          const shName = activeAssignment?.shift?.name || 'Assigned Shift';
          const shStart = activeAssignment?.shift?.startTime || '09:00 AM';
          const shEnd = activeAssignment?.shift?.endTime || '09:00 PM';
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
          const asgId = activeAssignment?.id || 'default_asg';

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
      } else if (evaluation.status === 'TEMPLATE_VERSION_UNSUPPORTED') {
        setVerificationState('NO_MATCH');
        setStatusMessage('Your face registration needs to be updated. Please re-register.');
      } else if (evaluation.status === 'TEMPLATE_UNAVAILABLE') {
        setVerificationState('NO_MATCH');
        setStatusMessage('No face template found. Please register your face first.');
      } else {
        // Face Not Matched
        const score = evaluation.status === 'FACE_NOT_MATCHED' ? evaluation.similarity.toFixed(2) : '0.00';
        setVerificationState('NO_MATCH');
        setStatusMessage(`Face Not Matched (Score: ${score}). Identity verification failed.`);
      }
    },
    [referenceTemplate, verificationState, user, cacheMeta, mode, activeAssignment, isConnected, navigation, checkpointParams],
  );

  const handleFrameProcessed = useRunOnJS(
    (faces: any[], width: number, height: number) => {
      processVerification(faces, width, height);
    },
    [processVerification],
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
          contours: f.contours,
        });
      }
      handleFrameProcessed(safeFaces, frame.width, frame.height);
    },
    [detectFaces, handleFrameProcessed],
  );

  const handleRetry = () => {
    isVerifyingRef.current = false;
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
          {mode === 'CHECKPOINT_UNLOCK' ? 'Checkpoint Face Gate' : 'Face Verification'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

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
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={verificationState === 'SEARCHING'}
          frameProcessor={frameProcessor}
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
