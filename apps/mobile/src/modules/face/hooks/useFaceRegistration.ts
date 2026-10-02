import { useState, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { FaceQualityValidator, FaceDetectionData } from '../engine/face-quality';
import { FaceLivenessValidator } from '../engine/face-liveness';
import { FaceEmbedder } from '../engine/face-embedder';
import { faceEnrollmentApi } from '../api/face-enrollment.api';
import { secureFaceCache } from '../services/secure-face-cache';
import { useAuthStore } from '../../../app/store/auth-store';

export type RegistrationStep = 'FRONT' | 'LEFT' | 'RIGHT' | 'COMPLETED';

export interface UseFaceRegistrationReturn {
  step: RegistrationStep;
  capturesCount: number;
  statusMessage: string;
  isProcessing: boolean;
  isSuccess: boolean;
  error: string | null;
  processFrame: (faces: any[], imageWidth: number, imageHeight: number) => Promise<void>;
  reset: () => void;
}

export function useFaceRegistration(onSuccess?: () => void): UseFaceRegistrationReturn {
  const user = useAuthStore((state) => state.user);
  const [step, setStep] = useState<RegistrationStep>('FRONT');
  const [capturesCount, setCapturesCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Look straight at the camera');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const capturedEmbeddingsRef = useRef<number[][]>([]);
  const livenessValidatorRef = useRef<FaceLivenessValidator>(new FaceLivenessValidator());
  const isSubmittingRef = useRef<boolean>(false);

  const reset = useCallback(() => {
    setStep('FRONT');
    setCapturesCount(0);
    setStatusMessage('Look straight at the camera');
    setIsProcessing(false);
    setIsSuccess(false);
    setError(null);
    capturedEmbeddingsRef.current = [];
    isSubmittingRef.current = false;
    livenessValidatorRef.current.startChallenge('BLINK');
  }, []);

  const processFrame = useCallback(
    async (faces: any[], imageWidth: number, imageHeight: number) => {
      if (isSubmittingRef.current || isSuccess) {
        return;
      }

      // Convert frame face data into FaceDetectionData
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
      const qualityResult = FaceQualityValidator.validate(mappedFaces, imageWidth, imageHeight);
      if (!qualityResult.valid) {
        setStatusMessage(qualityResult.message || 'Adjust position');
        return;
      }

      const faceData = mappedFaces[0];
      const currentStep = step;
      const yaw = faceData.yawAngle ?? 0;

      // 2. Step 1: Front Face + Liveness Blink Challenge
      if (currentStep === 'FRONT') {
        if (Math.abs(yaw) > 10) {
          setStatusMessage('Look straight at the camera');
          return;
        }

        const livenessStatus = livenessValidatorRef.current.processFrame(faceData);
        if (!livenessStatus.isCompleted) {
          setStatusMessage(livenessStatus.instructions || 'Blink to verify liveness');
          return;
        }

        // Capture 1: Front Vector
        const vector = await FaceEmbedder.generateEmbeddingAsync(faceData);
        capturedEmbeddingsRef.current.push(vector);
        setCapturesCount(1);
        setStep('LEFT');
        setStatusMessage('Great! Turn your head slightly to the left');

        livenessValidatorRef.current.startChallenge('TURN_LEFT');
        return;
      }

      // 3. Step 2: Left Face Turn Challenge
      if (currentStep === 'LEFT') {
        const livenessStatus = livenessValidatorRef.current.processFrame(faceData);

        if (!livenessStatus.isCompleted && yaw < 10) {
          setStatusMessage('Turn your head slightly to the left');
          return;
        }

        // Once turn left challenge is verified, wait for face to re-align straight to capture clean vector
        if (Math.abs(yaw) > 10) {
          setStatusMessage('Now look straight to confirm sample');
          return;
        }

        // Capture 2: Clean Re-aligned Vector
        const vector = await FaceEmbedder.generateEmbeddingAsync(faceData);
        capturedEmbeddingsRef.current.push(vector);
        setCapturesCount(2);
        setStep('RIGHT');
        setStatusMessage('Excellent! Now turn your head slightly to the right');

        livenessValidatorRef.current.startChallenge('TURN_RIGHT');
        return;
      }

      // 4. Step 3: Right Face Turn Challenge & Finalization
      if (currentStep === 'RIGHT') {
        const livenessStatus = livenessValidatorRef.current.processFrame(faceData);

        if (!livenessStatus.isCompleted && yaw > -10) {
          setStatusMessage('Turn your head slightly to the right');
          return;
        }

        // Once turn right challenge is verified, wait for face to re-align straight to capture clean vector
        if (Math.abs(yaw) > 10) {
          setStatusMessage('Now look straight to finalize registration');
          return;
        }

        // Capture 3: Clean Re-aligned Vector
        const vector = await FaceEmbedder.generateEmbeddingAsync(faceData);
        capturedEmbeddingsRef.current.push(vector);
        setCapturesCount(3);
        setStep('COMPLETED');
        setStatusMessage('Generating face template...');

        isSubmittingRef.current = true;
        setIsProcessing(true);

        // Check Online Connection
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          setIsProcessing(false);
          setError('Internet connection is required to register your face.');
          isSubmittingRef.current = false;
          return;
        }

        try {
          // Average the 3 normalized front quality captures
          const captures = capturedEmbeddingsRef.current;
          const dim = FaceEmbedder.EMBEDDING_DIMENSION;
          const sumVec = new Float32Array(dim);

          for (const cap of captures) {
            for (let i = 0; i < dim; i++) {
              sumVec[i] += cap[i];
            }
          }

          const avgVec = new Float32Array(dim);
          for (let i = 0; i < dim; i++) {
            avgVec[i] = sumVec[i] / captures.length;
          }

          const referenceTemplate = Array.from(FaceEmbedder.normalizeL2(avgVec));

          // Submit to backend API (Phase 2 template versioning: SFace v2)
          const regResult = await faceEnrollmentApi.register(referenceTemplate, 'SFace', 'v2', dim);

          // Save to Keystore-backed encrypted local cache
          const empId = user?.employeeId || (user as any)?.employee?.id || '';
          const clientId = (user as any)?.clientId || (user as any)?.employee?.clientId || '';

          if (user?.id && empId) {
            await secureFaceCache.saveSecureCache(user.id, empId, clientId, {
              template: referenceTemplate,
              modelName: 'SFace',
              modelVersion: 'v2',
              embeddingDimension: dim,
              registeredAt: regResult.registeredAt || new Date().toISOString(),
            });
          }

          setIsProcessing(false);
          setIsSuccess(true);
          setStatusMessage('Face Registered Successfully');
          if (onSuccess) {
            onSuccess();
          }
        } catch (err: any) {
          setIsProcessing(false);
          isSubmittingRef.current = false;
          const msg =
            err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            'Unable to save face registration.';
          setError(msg);
        }
      }
    },
    [step, isSuccess, user, onSuccess],
  );

  return {
    step,
    capturesCount,
    statusMessage,
    isProcessing,
    isSuccess,
    error,
    processFrame,
    reset,
  };
}
