import { FaceDetectionData } from './face-quality';
import { faceModelManager, FaceModelManager } from './face-model-manager';

/**
 * Feature Embedder & L2 Normalization Engine (Phase 2 Neural SFace Architecture)
 * Extracts real 128-dimensional float embedding vectors from the official OpenCV Zoo SFace ONNX model.
 */
export class FaceEmbedder {
  static EMBEDDING_DIMENSION = FaceModelManager.EMBEDDING_DIMENSION;
  static MODEL_NAME = FaceModelManager.MODEL_NAME;
  static MODEL_VERSION = FaceModelManager.MODEL_VERSION;

  /**
   * Asynchronously generates a real neural 128-D zero-mean L2-normalized embedding using SFace ONNX.
   */
  static async generateEmbeddingAsync(face: FaceDetectionData): Promise<number[]> {
    return faceModelManager.extractEmbedding(face);
  }

  /**
   * Synchronous embedding extraction fallback.
   */
  static generateEmbedding(face: FaceDetectionData): number[] {
    const g = faceModelManager.extractLandmarkGeometry(face);
    return Array.from(FaceEmbedder.normalizeL2(g));
  }

  /**
   * Zero-mean L2 Vector Normalization Helper
   * Ensures ||v||_2 = 1.0 for Cosine Similarity computation
   */
  static normalizeL2(vector: Float32Array | number[]): Float32Array {
    return faceModelManager.normalizeZeroMeanL2(vector);
  }
}
