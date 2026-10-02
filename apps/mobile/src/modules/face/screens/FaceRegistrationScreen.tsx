import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { useRunOnJS } from 'react-native-worklets-core';
import { useTheme } from '../../../app/hooks/useTheme';
import { FaceGuideOverlay } from '../components/FaceGuideOverlay';
import { useFaceRegistration } from '../hooks/useFaceRegistration';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react-native';

export function FaceRegistrationScreen({ navigation }: any) {
  const { colors } = useTheme();
  const device = useCameraDevice('front');
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const { detectFaces } = useFaceDetector({
    performanceMode: 'accurate',
    contourMode: 'all',
    landmarkMode: 'all',
    classificationMode: 'all',
    minFaceSize: 0.15,
  });

  const {
    step,
    capturesCount,
    statusMessage,
    isProcessing,
    isSuccess,
    error,
    processFrame,
    reset,
  } = useFaceRegistration();

  const handleFrameProcessed = useRunOnJS(
    (faces: any[], width: number, height: number) => {
      processFrame(faces, width, height);
    },
    [processFrame],
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

  if (!hasPermission) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>Camera permission required</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>No front camera available</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Face Registration</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Camera Preview */}
      <View style={styles.cameraContainer}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!isSuccess}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
        />
        <FaceGuideOverlay statusColor={colors.primary} />

        {/* Step Indicator */}
        <View style={styles.stepContainer}>
          <View style={[styles.stepDot, capturesCount >= 1 ? styles.stepActive : styles.stepInactive]} />
          <View style={[styles.stepLine, capturesCount >= 2 ? styles.stepLineActive : styles.stepLineInactive]} />
          <View style={[styles.stepDot, capturesCount >= 2 ? styles.stepActive : styles.stepInactive]} />
          <View style={[styles.stepLine, capturesCount >= 3 ? styles.stepLineActive : styles.stepLineInactive]} />
          <View style={[styles.stepDot, capturesCount >= 3 ? styles.stepActive : styles.stepInactive]} />
        </View>

        {/* Real-time Instruction Banner */}
        <View style={styles.instructionBanner}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : null}
          <Text style={styles.instructionText}>{statusMessage}</Text>
        </View>
      </View>

      {/* Error State */}
      {error ? (
        <View style={[styles.errorCard, { backgroundColor: colors.danger + '15' }]}>
          <AlertCircle size={20} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.errorCardText, { color: colors.danger }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reset}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Success Modal Confirmation */}
      <Modal visible={isSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.successIconContainer}>
              <CheckCircle2 size={48} color="#10B981" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Face Registered Successfully</Text>
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
              Your face verification profile is ready.
            </Text>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  errorText: {
    fontSize: 16,
    fontWeight: '700',
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
  stepContainer: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepActive: {
    backgroundColor: '#10B981',
  },
  stepInactive: {
    backgroundColor: '#6B7280',
  },
  stepLine: {
    width: 24,
    height: 2,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#10B981',
  },
  stepLineInactive: {
    backgroundColor: '#6B7280',
  },
  instructionBanner: {
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
  instructionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorCard: {
    padding: 16,
    margin: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorCardText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    elevation: 8,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
