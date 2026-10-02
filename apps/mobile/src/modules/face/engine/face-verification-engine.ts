import { FaceDetectionData, FaceQualityValidator, QualityResult } from './face-quality';
import { FaceMatcher, MatchResult } from './face-matcher';
import { faceModelManager, FaceModelManager } from './face-model-manager';

export type FaceVerificationResult =
  | { status: 'FACE_VERIFIED'; similarity: number; threshold: number; templateVersion: string }
  | { status: 'FACE_NOT_MATCHED'; similarity: number; threshold: number; templateVersion: string }
  | { status: 'TEMPLATE_UNAVAILABLE' }
  | { status: 'TEMPLATE_VERSION_UNSUPPORTED'; version?: string }
  | { status: 'LIVENESS_FAILED' }
  | { status: 'FACE_QUALITY_FAILED'; message: string };

export interface VerificationContext {
  userId: string;
  employeeId: string;
  referenceTemplate: number[] | null;
  templateVersion?: string;
  customThreshold?: number;
  livenessPassed?: boolean;
}

/**
 * Unified Face Verification Engine (Phase 2 Real SFace ONNX Architecture)
 * Centralizes quality evaluation, liveness validation, SFace neural embedding generation,
 * cosine similarity matching, and strict template version governance.
 */
export class FaceVerificationEngine {
  /**
   * Calibrated Development Threshold for SFace Cosine Similarity
   */
  static readonly DEFAULT_MATCH_THRESHOLD = 0.50;

  /**
   * Active Biometric Template Version (SFace Neural Embedding)
   */
  static readonly CURRENT_TEMPLATE_VERSION = FaceModelManager.MODEL_VERSION;
  static readonly MODEL_NAME = FaceModelManager.MODEL_NAME;

  /**
   * Validate detected face bounding boxes and pose quality
   */
  static validateQuality(
    faces: FaceDetectionData[],
    frameWidth: number,
    frameHeight: number,
  ): QualityResult {
    return FaceQualityValidator.validate(faces, frameWidth, frameHeight);
  }

  /**
   * Check if an enrolled biometric template version is supported
   */
  static isTemplateVersionSupported(version?: string): boolean {
    if (!version) return false;
    return version === this.CURRENT_TEMPLATE_VERSION || version === '2.0' || version === 'v2.0';
  }

  /**
   * Generate real SFace ONNX neural embedding vector from face data
   */
  static async generateEmbeddingAsync(face: FaceDetectionData): Promise<number[]> {
    return faceModelManager.extractEmbedding(face);
  }

  /**
   * Perform 1:1 Cosine Similarity Matching
   */
  static match(
    candidate: number[],
    reference: number[],
    threshold: number = this.DEFAULT_MATCH_THRESHOLD,
  ): MatchResult {
    return FaceMatcher.match(candidate, reference, threshold);
  }

  /**
   * Asynchronously evaluates a live camera face frame against the reference template using real SFace inference.
   */
  static async evaluateFrameAsync(
    faces: FaceDetectionData[],
    frameWidth: number,
    frameHeight: number,
    context: VerificationContext,
  ): Promise<FaceVerificationResult> {
    const { referenceTemplate, templateVersion, customThreshold, employeeId, livenessPassed } = context;

    // 1. Template Presence Check
    if (!referenceTemplate || referenceTemplate.length === 0) {
      if (__DEV__) {
        console.log(`[FACE_VERIFY]\nemployeeId: ${employeeId || 'UNKNOWN'}\ntemplateExists: false\nfinalDecision: TEMPLATE_UNAVAILABLE`);
      }
      return { status: 'TEMPLATE_UNAVAILABLE' };
    }

    // 2. Template Version Check (v1 synthetic vs v2 SFace neural embedding)
    if (templateVersion && !this.isTemplateVersionSupported(templateVersion)) {
      if (__DEV__) {
        console.log(`[FACE_VERIFY]\nemployeeId: ${employeeId || 'UNKNOWN'}\ntemplateExists: true\ntemplateVersion: ${templateVersion}\nfinalDecision: TEMPLATE_VERSION_UNSUPPORTED`);
      }
      return { status: 'TEMPLATE_VERSION_UNSUPPORTED', version: templateVersion };
    }

    // 3. Face Quality Check
    const quality = this.validateQuality(faces, frameWidth, frameHeight);
    if (!quality.valid) {
      return { status: 'FACE_QUALITY_FAILED', message: quality.message };
    }

    // 4. Liveness Gate
    if (livenessPassed === false) {
      return { status: 'LIVENESS_FAILED' };
    }

    // 5. Candidate SFace Neural Embedding Generation
    const candidateFace = faces[0];
    let candidateEmbedding: number[];
    try {
      candidateEmbedding = await this.generateEmbeddingAsync(candidateFace);
    } catch (err: any) {
      return { status: 'FACE_QUALITY_FAILED', message: 'Neural inference initializing...' };
    }

    // 6. 1:1 Cosine Similarity Match against Stored Registered Template
    const threshold = customThreshold ?? this.DEFAULT_MATCH_THRESHOLD;
    const matchResult = this.match(candidateEmbedding, referenceTemplate, threshold);
    const score = matchResult.similarityScore;
    const finalDecision = matchResult.isMatch ? 'FACE_VERIFIED' : 'FACE_NOT_MATCHED';

    // 7. Standardized Development Diagnostic Logging
    if (__DEV__) {
      console.log(
        `[FACE_VERIFY]\n` +
        `employeeId: ${employeeId || 'UNKNOWN'}\n` +
        `templateExists: true\n` +
        `templateVersion: ${templateVersion || this.CURRENT_TEMPLATE_VERSION}\n` +
        `registeredEmbeddingLength: ${referenceTemplate.length}\n` +
        `candidateEmbeddingLength: ${candidateEmbedding.length}\n` +
        `similarityScore: ${score.toFixed(4)}\n` +
        `threshold: ${threshold.toFixed(2)}\n` +
        `livenessCompleted: ${Boolean(livenessPassed)}\n` +
        `finalDecision: ${finalDecision}`
      );
    }

    if (matchResult.isMatch) {
      return {
        status: 'FACE_VERIFIED',
        similarity: score,
        threshold,
        templateVersion: templateVersion || this.CURRENT_TEMPLATE_VERSION,
      };
    }

    return {
      status: 'FACE_NOT_MATCHED',
      similarity: score,
      threshold,
      templateVersion: templateVersion || this.CURRENT_TEMPLATE_VERSION,
    };
  }
}
