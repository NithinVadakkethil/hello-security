import { FaceModelManager } from '../face-model-manager';
import { FaceMatcher } from '../face-matcher';
import { FaceVerificationEngine } from '../face-verification-engine';
import { FaceEmbedder } from '../face-embedder';

describe('SFace Face Verification Pipeline (Phase 2)', () => {
  const mockFace1 = {
    bounds: { x: 100, y: 150, width: 200, height: 250 },
    landmarks: {
      LEFT_EYE: { x: 150, y: 220 },
      RIGHT_EYE: { x: 230, y: 220 },
      NOSE_BASE: { x: 190, y: 260 },
      MOUTH_LEFT: { x: 160, y: 310 },
      MOUTH_RIGHT: { x: 220, y: 310 },
      MOUTH_BOTTOM: { x: 190, y: 335 },
      LEFT_CHEEK: { x: 135, y: 270 },
      RIGHT_CHEEK: { x: 245, y: 270 },
    },
  };

  const mockFace2Similar = {
    bounds: { x: 105, y: 152, width: 198, height: 248 },
    landmarks: {
      LEFT_EYE: { x: 152, y: 222 },
      RIGHT_EYE: { x: 231, y: 221 },
      NOSE_BASE: { x: 191, y: 262 },
      MOUTH_LEFT: { x: 161, y: 311 },
      MOUTH_RIGHT: { x: 221, y: 309 },
      MOUTH_BOTTOM: { x: 191, y: 336 },
      LEFT_CHEEK: { x: 136, y: 272 },
      RIGHT_CHEEK: { x: 246, y: 271 },
    },
  };

  const mockFaceImpostor = {
    bounds: { x: 80, y: 100, width: 300, height: 350 },
    landmarks: {
      LEFT_EYE: { x: 130, y: 180 },
      RIGHT_EYE: { x: 290, y: 180 },
      NOSE_BASE: { x: 210, y: 240 },
      MOUTH_LEFT: { x: 150, y: 340 },
      MOUTH_RIGHT: { x: 270, y: 340 },
      MOUTH_BOTTOM: { x: 210, y: 360 },
      LEFT_CHEEK: { x: 110, y: 260 },
      RIGHT_CHEEK: { x: 310, y: 260 },
    },
  };

  test('Similarity transformation maps landmarks to 112x112 canonical coordinates', () => {
    const manager = FaceModelManager.getInstance();
    const srcLandmarks: [number, number][] = [
      [150, 220],
      [230, 220],
      [190, 260],
      [160, 310],
      [220, 310],
    ];
    const transform = manager.computeSimilarityTransform(srcLandmarks);

    expect(transform.scale).toBeGreaterThan(0);
    expect(Number.isFinite(transform.rotation)).toBe(true);
    expect(transform.translation).toHaveLength(2);
  });

  test('Prepares 1x3x112x112 NCHW Float32 tensor buffer', () => {
    const manager = FaceModelManager.getInstance();
    const tensorBuffer = manager.prepareInputTensor(mockFace1 as any);

    expect(tensorBuffer).toBeInstanceOf(Float32Array);
    expect(tensorBuffer.length).toBe(1 * 3 * 112 * 112); // 37632 elements

    // Verify finite values
    for (let i = 0; i < 100; i++) {
      expect(Number.isFinite(tensorBuffer[i])).toBe(true);
    }
  });

  test('L2 Normalization enforces unit norm ||v||_2 = 1.0', () => {
    const manager = FaceModelManager.getInstance();
    const rawVec = new Float32Array([3.0, 4.0, 0.0, 0.0]);
    const normalized = manager.normalizeL2(rawVec);

    let sumSq = 0;
    for (let i = 0; i < normalized.length; i++) {
      sumSq += normalized[i] * normalized[i];
    }
    expect(Math.abs(Math.sqrt(sumSq) - 1.0)).toBeLessThan(1e-5);
  });

  test('Cosine similarity matches genuine face pairs with high similarity', () => {
    const emb1 = FaceEmbedder.generateEmbedding(mockFace1 as any);
    const emb2 = FaceEmbedder.generateEmbedding(mockFace2Similar as any);

    const match = FaceMatcher.match(emb1, emb2, 0.50);
    expect(match.similarityScore).toBeGreaterThan(0.85);
    expect(match.isMatch).toBe(true);
  });

  test('Cosine similarity rejects impostor faces', () => {
    const emb1 = FaceEmbedder.generateEmbedding(mockFace1 as any);
    const embImpostor = FaceEmbedder.generateEmbedding(mockFaceImpostor as any);

    const match = FaceMatcher.match(emb1, embImpostor, 0.50);
    expect(match.similarityScore).toBeLessThan(0.40);
    expect(match.isMatch).toBe(false);
  });

  test('Explicitly rejects legacy v1 synthetic templates with TEMPLATE_VERSION_UNSUPPORTED', async () => {
    const context = {
      userId: 'user_123',
      employeeId: 'emp_123',
      referenceTemplate: new Array(128).fill(0.1),
      templateVersion: 'v1',
      livenessPassed: true,
    };

    const evaluation = await FaceVerificationEngine.evaluateFrameAsync(
      [mockFace1 as any],
      720,
      1280,
      context,
    );

    expect(evaluation.status).toBe('TEMPLATE_VERSION_UNSUPPORTED');
  });

  test('Accepts valid v2 SFace template for evaluation', async () => {
    const emb1 = FaceEmbedder.generateEmbedding(mockFace1 as any);
    const context = {
      userId: 'user_123',
      employeeId: 'emp_123',
      referenceTemplate: emb1,
      templateVersion: 'v2',
      livenessPassed: true,
    };

    const evaluation = await FaceVerificationEngine.evaluateFrameAsync(
      [mockFace1 as any],
      720,
      1280,
      context,
    );

    expect(evaluation.status).toBe('FACE_VERIFIED');
    if (evaluation.status === 'FACE_VERIFIED') {
      expect(evaluation.similarity).toBeGreaterThanOrEqual(0.99);
    }
  });
});
