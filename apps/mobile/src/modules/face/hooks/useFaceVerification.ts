import { useState, useRef, useCallback } from 'react';
import { FaceDetectionData, FaceQualityValidator } from '../engine/face-quality';
import { FaceEmbedder } from '../engine/face-embedder';
import { FaceMatcher, MatchResult } from '../engine/face-matcher';
import { FaceLivenessValidator, LivenessStatus } from '../engine/face-liveness';

export type VerificationState =
  | 'INITIALIZING'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'TOO_FAR'
  | 'TOO_CLOSE'
  | 'OFF_CENTER'
  | 'LOOK_STRAIGHT'
  | 'READY'
  | 'CAPTURING'
  | 'LIVENESS_REQUIRED'
  | 'LIVENESS_PASSED'
  | 'VERIFYING'
  | 'MATCH'
  | 'NO_MATCH';

export interface VerificationMetrics {
  detectionTimeMs: number;
  embeddingTimeMs: number;
  similarityScore: number;
  euclideanDistance: number;
  lastVerifiedAt: string | null;
}

export function useFaceVerification() {
  const [state, setState] = useState<VerificationState>('INITIALIZING');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing camera...');
  const [livenessStatus, setLivenessStatus] = useState<LivenessStatus | null>(null);
  const [metrics, setMetrics] = useState<VerificationMetrics>({
    detectionTimeMs: 0,
    embeddingTimeMs: 0,
    similarityScore: 0,
    euclideanDistance: 0,
    lastVerifiedAt: null,
  });

  // In-memory Phase 0 enrolled reference embedding ONLY (Volatile RAM)
  const referenceEmbeddingRef = useRef<number[] | null>(null);
  const livenessValidatorRef = useRef(new FaceLivenessValidator());
  const isProcessingFrameRef = useRef(false);

  /**
   * Enroll current face into React runtime memory (Phase 0 Spike ONLY)
   */
  const enrollTemporaryReference = useCallback((face: FaceDetectionData) => {
    const startEmb = Date.now();
    const embedding = FaceEmbedder.generateEmbedding(face);
    const embTime = Date.now() - startEmb;

    referenceEmbeddingRef.current = embedding;

    setMetrics(prev => ({
      ...prev,
      embeddingTimeMs: embTime,
      lastVerifiedAt: new Date().toLocaleTimeString(),
    }));

    setState('READY');
    setStatusMessage('Temporary face reference enrolled in memory!');
    return embedding;
  }, []);

  /**
   * Clear in-memory reference template
   */
  const clearEnrollment = useCallback(() => {
    referenceEmbeddingRef.current = null;
    setState('INITIALIZING');
    setStatusMessage('Reference template cleared.');
  }, []);

  /**
   * Process a live camera frame
   */
  const processFrame = useCallback(
    (faces: FaceDetectionData[], frameWidth = 480, frameHeight = 640) => {
      if (isProcessingFrameRef.current) return;
      isProcessingFrameRef.current = true;

      const startTime = Date.now();

      try {
        // 1. Quality Validation
        const qualityResult = FaceQualityValidator.validate(faces, frameWidth, frameHeight);

        if (!qualityResult.valid) {
          switch (qualityResult.reason) {
            case 'NO_FACE':
              setState('NO_FACE');
              break;
            case 'MULTIPLE_FACES':
              setState('MULTIPLE_FACES');
              break;
            case 'TOO_FAR':
              setState('TOO_FAR');
              break;
            case 'TOO_CLOSE':
              setState('TOO_CLOSE');
              break;
            case 'OFF_CENTER':
              setState('OFF_CENTER');
              break;
            case 'BAD_POSE':
              setState('LOOK_STRAIGHT');
              break;
          }
          setStatusMessage(qualityResult.message);
          return;
        }

        const face = faces[0];
        const detectTime = Date.now() - startTime;

        // 2. Liveness Evaluation
        const liveness = livenessValidatorRef.current.processFrame(face);
        setLivenessStatus(liveness);

        if (!liveness.isCompleted) {
          setState('LIVENESS_REQUIRED');
          setStatusMessage(liveness.instructions);
          return;
        }

        setState('LIVENESS_PASSED');

        // 3. Extract Feature Embedding
        const startEmb = Date.now();
        const candidateEmbedding = FaceEmbedder.generateEmbedding(face);
        const embTime = Date.now() - startEmb;

        // If no reference enrolled yet, prompt user to tap "Enroll Reference"
        if (!referenceEmbeddingRef.current) {
          setState('READY');
          setStatusMessage('Face aligned & quality verified. Tap "Enroll Reference"');
          setMetrics(prev => ({
            ...prev,
            detectionTimeMs: detectTime,
            embeddingTimeMs: embTime,
          }));
          return;
        }

        // 4. Perform 1:1 Cosine & Euclidean Matching
        setState('VERIFYING');
        const matchResult: MatchResult = FaceMatcher.match(
          candidateEmbedding,
          referenceEmbeddingRef.current,
        );

        setMetrics({
          detectionTimeMs: detectTime,
          embeddingTimeMs: embTime,
          similarityScore: matchResult.similarityScore,
          euclideanDistance: matchResult.euclideanDistance,
          lastVerifiedAt: new Date().toLocaleTimeString(),
        });

        if (matchResult.isMatch) {
          setState('MATCH');
          setStatusMessage(
            `Face Verified! Score: ${(matchResult.similarityScore * 100).toFixed(1)}%`,
          );
        } else {
          setState('NO_MATCH');
          setStatusMessage(
            `Face Not Matched. Score: ${(matchResult.similarityScore * 100).toFixed(1)}%`,
          );
        }
      } finally {
        isProcessingFrameRef.current = false;
      }
    },
    [],
  );

  /**
   * Start fresh liveness challenge sequence
   */
  const startLivenessChallenge = useCallback(() => {
    const status = livenessValidatorRef.current.startChallenge();
    setLivenessStatus(status);
    setStatusMessage(status.instructions);
  }, []);

  return {
    state,
    statusMessage,
    livenessStatus,
    metrics,
    hasEnrolledReference: Boolean(referenceEmbeddingRef.current),
    enrollTemporaryReference,
    clearEnrollment,
    processFrame,
    startLivenessChallenge,
  };
}
