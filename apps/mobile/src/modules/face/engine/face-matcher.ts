/**
 * Face Matcher Engine
 * Calculates Cosine Similarity & Euclidean Distance between 1:1 biometric embedding vectors.
 */

export interface MatchResult {
  isMatch: boolean;
  similarityScore: number;
  euclideanDistance: number;
  thresholdUsed: number;
}

export class FaceMatcher {
  /**
   * Prototype Similarity Threshold (Configurable for Phase 0 technical spike testing)
   * 0.85 indicates 85%+ feature embedding vector alignment
   */
  static PROTOTYPE_THRESHOLD = 0.85;

  /**
   * Calculate Cosine Similarity between two L2-normalized embedding vectors.
   * Returns a value in range [0.0, 1.0]
   */
  static calculateCosineSimilarity(emb1: number[], emb2: number[]): number {
    if (!emb1 || !emb2 || emb1.length !== emb2.length || emb1.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < emb1.length; i++) {
      dotProduct += emb1[i] * emb2[i];
      normA += emb1[i] * emb1[i];
      normB += emb2[i] * emb2[i];
    }

    if (normA === 0 || normB === 0) return 0;

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(0, Math.min(1.0, similarity));
  }

  /**
   * Calculate Euclidean Distance between two embedding vectors
   */
  static calculateEuclideanDistance(emb1: number[], emb2: number[]): number {
    if (!emb1 || !emb2 || emb1.length !== emb2.length) {
      return Infinity;
    }

    let sumSq = 0;
    for (let i = 0; i < emb1.length; i++) {
      const diff = emb1[i] - emb2[i];
      sumSq += diff * diff;
    }

    return Math.sqrt(sumSq);
  }

  /**
   * Match a candidate embedding against a reference template
   * @param candidate Candidate embedding vector from camera frame
   * @param reference Enrolled reference template embedding vector
   * @param threshold Optional custom similarity threshold (defaults to PROTOTYPE_THRESHOLD)
   */
  static match(
    candidate: number[],
    reference: number[],
    threshold: number = FaceMatcher.PROTOTYPE_THRESHOLD,
  ): MatchResult {
    const similarityScore = this.calculateCosineSimilarity(candidate, reference);
    const euclideanDistance = this.calculateEuclideanDistance(candidate, reference);
    const isMatch = similarityScore >= threshold;

    return {
      isMatch,
      similarityScore,
      euclideanDistance,
      thresholdUsed: threshold,
    };
  }
}
