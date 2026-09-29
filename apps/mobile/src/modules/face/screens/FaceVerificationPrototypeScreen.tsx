import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  AppState,
  AppStateStatus,
  ScrollView,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ArrowLeft, RefreshCw, UserCheck, ShieldAlert, Zap } from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { useFaceVerification } from '../hooks/useFaceVerification';
import { FaceGuideOverlay } from '../components/FaceGuideOverlay';
import { VerificationStatus } from '../components/VerificationStatus';
import { FaceDetectionData } from '../engine/face-quality';

export function FaceVerificationPrototypeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  const {
    state,
    statusMessage,
    livenessStatus,
    metrics,
    hasEnrolledReference,
    enrollTemporaryReference,
    clearEnrollment,
    processFrame,
    startLivenessChallenge,
  } = useFaceVerification();

  const currentFaceRef = useRef<FaceDetectionData | null>(null);

  // AppState listener for safe backgrounding
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      setAppState(nextState);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hasPermission && isFocused) {
      requestPermission();
    }
  }, [hasPermission, isFocused, requestPermission]);

  const isCameraActive = isFocused && appState === 'active';

  // Throttled Simulated Frame Processing Loop for Phase 0 Spike
  useEffect(() => {
    if (!isCameraActive) return;

    const interval = setInterval(() => {
      // Simulate real-time detected face frame for Phase 0 evaluation
      const simulatedFace: FaceDetectionData = {
        bounds: { x: 100, y: 120, width: 220, height: 260 },
        rollAngle: Math.random() * 4 - 2,
        pitchAngle: Math.random() * 4 - 2,
        yawAngle: livenessStatus?.challengeType === 'TURN_LEFT' ? 16 : livenessStatus?.challengeType === 'TURN_RIGHT' ? -16 : 2,
        leftEyeOpenProbability: livenessStatus?.challengeType === 'BLINK' ? Math.random() < 0.3 ? 0.1 : 0.95 : 0.95,
        rightEyeOpenProbability: livenessStatus?.challengeType === 'BLINK' ? Math.random() < 0.3 ? 0.1 : 0.95 : 0.95,
        landmarks: {
          leftEye: { x: 150, y: 200 },
          rightEye: { x: 270, y: 200 },
          nose: { x: 210, y: 240 },
          mouth: { x: 210, y: 300 },
        },
      };

      currentFaceRef.current = simulatedFace;
      processFrame([simulatedFace], 480, 640);
    }, 400);

    return () => clearInterval(interval);
  }, [isCameraActive, processFrame, livenessStatus?.challengeType]);

  const handleEnrollPress = () => {
    if (currentFaceRef.current) {
      enrollTemporaryReference(currentFaceRef.current);
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case 'MATCH':
      case 'LIVENESS_PASSED':
        return '#22c55e';
      case 'NO_MATCH':
        return '#ef4444';
      case 'LIVENESS_REQUIRED':
        return '#f59e0b';
      default:
        return '#2563eb';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Face Verification Spike</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Main Camera Container */}
      <View style={styles.cameraContainer}>
        {hasPermission && device && isCameraActive ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isCameraActive}
            photo={false}
          />
        ) : (
          <View style={[styles.cameraFallback, { backgroundColor: '#0f172a' }]}>
            <ShieldAlert size={48} color="#64748b" />
            <Text style={styles.fallbackText}>Camera Unavailable or Backgrounded</Text>
          </View>
        )}

        {/* Face Oval Cutout Overlay */}
        <FaceGuideOverlay statusColor={getStatusColor()} />

        {/* Top Status Badge */}
        <View style={styles.statusBadgeWrapper}>
          <VerificationStatus state={state} message={statusMessage} />
        </View>

        {/* Bottom Control Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: hasEnrolledReference ? '#2563eb' : '#16a34a' },
            ]}
            onPress={handleEnrollPress}
          >
            <UserCheck size={18} color="#ffffff" />
            <Text style={styles.actionButtonText}>
              {hasEnrolledReference ? 'Re-Enroll (RAM)' : 'Enroll Reference (RAM)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#d97706' }]}
            onPress={startLivenessChallenge}
          >
            <Zap size={18} color="#ffffff" />
            <Text style={styles.actionButtonText}>Liveness Challenge</Text>
          </TouchableOpacity>

          {hasEnrolledReference && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
              onPress={clearEnrollment}
            >
              <RefreshCw size={18} color="#ffffff" />
              <Text style={styles.actionButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Diagnostics Panel */}
      <ScrollView style={styles.diagnosticsContainer}>
        <Text style={[styles.diagTitle, { color: colors.primary }]}>
          Phase 0 Diagnostics (On-Device Spike)
        </Text>
        <View style={styles.diagRow}>
          <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Enrolled Status:</Text>
          <Text style={[styles.diagValue, { color: hasEnrolledReference ? '#22c55e' : '#f59e0b' }]}>
            {hasEnrolledReference ? 'ENROLLED (IN-MEMORY ONLY)' : 'NOT ENROLLED'}
          </Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Detection Latency:</Text>
          <Text style={[styles.diagValue, { color: colors.text }]}>{metrics.detectionTimeMs} ms</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Embedding Extractor:</Text>
          <Text style={[styles.diagValue, { color: colors.text }]}>{metrics.embeddingTimeMs} ms</Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Cosine Similarity:</Text>
          <Text style={[styles.diagValue, { color: metrics.similarityScore >= 0.85 ? '#22c55e' : colors.text }]}>
            {(metrics.similarityScore * 100).toFixed(2)}%
          </Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Euclidean Distance:</Text>
          <Text style={[styles.diagValue, { color: colors.text }]}>
            {metrics.euclideanDistance.toFixed(4)}
          </Text>
        </View>
        <View style={styles.diagRow}>
          <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Prototype Threshold:</Text>
          <Text style={[styles.diagValue, { color: colors.text }]}>0.85 (Cosine)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerRightPlaceholder: {
    width: 34,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  cameraFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  fallbackText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadgeWrapper: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  diagnosticsContainer: {
    maxHeight: 180,
    padding: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  diagTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  diagLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  diagValue: {
    fontSize: 12,
    fontWeight: '800',
  },
});
