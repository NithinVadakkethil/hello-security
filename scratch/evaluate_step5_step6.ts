/**
 * Statistical Biometric Distribution Evaluator
 * Runs the exact mathematics from FaceModelManager and FaceMatcher
 */
class LocalFaceMatcher {
  static calculateCosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 1e-12 ? Math.max(-1, Math.min(1, dot / denom)) : 0;
  }
}

function normalizeZeroMeanL2(vector: Float32Array | number[]): Float32Array {
  let mean = 0;
  for (let i = 0; i < vector.length; i++) mean += vector[i];
  mean /= vector.length;

  let sumSq = 0;
  const centered = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    const val = vector[i] - mean;
    centered[i] = val;
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq);
  const normalized = new Float32Array(vector.length);
  if (norm < 1e-12) return normalized;
  for (let i = 0; i < vector.length; i++) normalized[i] = centered[i] / norm;
  return normalized;
}

function extractLandmarkGeometry(face: FaceDetectionData): number[] {
  const { bounds, landmarks = {}, contours = {} } = face;
  const fw = Math.max(bounds.width || 1, 1);
  const fh = Math.max(bounds.height || 1, 1);

  const leftEye = landmarks['LEFT_EYE'] || { x: bounds.x + fw * 0.35, y: bounds.y + fh * 0.40 };
  const rightEye = landmarks['RIGHT_EYE'] || { x: bounds.x + fw * 0.65, y: bounds.y + fh * 0.40 };
  const nose = landmarks['NOSE_BASE'] || { x: bounds.x + fw * 0.50, y: bounds.y + fh * 0.55 };
  const leftMouth = landmarks['MOUTH_LEFT'] || { x: bounds.x + fw * 0.38, y: bounds.y + fh * 0.75 };
  const rightMouth = landmarks['MOUTH_RIGHT'] || { x: bounds.x + fw * 0.62, y: bounds.y + fh * 0.75 };
  const mouthBottom = landmarks['MOUTH_BOTTOM'] || { x: bounds.x + fw * 0.50, y: bounds.y + fh * 0.82 };
  const leftCheek = landmarks['LEFT_CHEEK'] || { x: bounds.x + fw * 0.25, y: bounds.y + fh * 0.60 };
  const rightCheek = landmarks['RIGHT_CHEEK'] || { x: bounds.x + fw * 0.75, y: bounds.y + fh * 0.60 };

  const x0 = (leftEye.x + rightEye.x) / 2;
  const y0 = (leftEye.y + rightEye.y) / 2;
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const iod = Math.hypot(dx, dy) || 1;
  const theta = Math.atan2(dy, dx);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const toCanonical = (pt: { x: number; y: number }): { u: number; v: number } => {
    const rx = pt.x - x0;
    const ry = pt.y - y0;
    return {
      u: (rx * cosT + ry * sinT) / iod,
      v: (-rx * sinT + ry * cosT) / iod,
    };
  };

  const faceContour = (contours['FACE'] || []).map(toCanonical);
  const canonNose = toCanonical(nose);
  const canonMouthL = toCanonical(leftMouth);
  const canonMouthR = toCanonical(rightMouth);
  const canonChin = toCanonical(mouthBottom);
  const canonCheekL = toCanonical(leftCheek);
  const canonCheekR = toCanonical(rightCheek);

  const nPts = faceContour.length || 24;
  const descriptors: number[] = [];

  for (let k = 0; k < 24; k++) {
    let sumCos = 0;
    let sumSin = 0;
    for (let i = 0; i < nPts; i++) {
      const p = faceContour[i] || { u: 0, v: 0 };
      const r = Math.hypot(p.u, p.v);
      const phi = (i * 2 * Math.PI * (k + 1)) / nPts;
      sumCos += r * Math.cos(phi);
      sumSin += r * Math.sin(phi);
    }
    descriptors.push(sumCos / nPts);
    descriptors.push(sumSin / nPts);
  }

  const mouthCenterU = (canonMouthL.u + canonMouthR.u) / 2;
  const mouthCenterV = (canonMouthL.v + canonMouthR.v) / 2;
  const mouthWidth = Math.hypot(canonMouthR.u - canonMouthL.u, canonMouthR.v - canonMouthL.v);
  const noseLength = Math.hypot(canonNose.u, canonNose.v);
  const noseToMouth = Math.hypot(mouthCenterU - canonNose.u, mouthCenterV - canonNose.v);
  const cheekSpan = Math.hypot(canonCheekR.u - canonCheekL.u, canonCheekR.v - canonCheekL.v);
  const chinToNose = Math.hypot(canonChin.u - canonNose.u, canonChin.v - canonNose.v);

  descriptors.push(
    canonNose.u,
    canonNose.v,
    canonMouthL.u,
    canonMouthL.v,
    canonMouthR.u,
    canonMouthR.v,
    canonChin.u,
    canonChin.v,
    canonCheekL.u,
    canonCheekL.v,
    canonCheekR.u,
    canonCheekR.v,
    mouthWidth,
    noseLength,
    noseToMouth,
    cheekSpan,
    chinToNose,
    mouthCenterV,
    canonNose.v / (mouthCenterV || 1),
    mouthWidth / (noseLength || 1),
    cheekSpan / (mouthWidth || 1),
    chinToNose / (noseLength || 1),
    fw / fh,
    iod / fw,
  );

  while (descriptors.length < 128) {
    const idx = descriptors.length % nPts;
    const p = faceContour[idx] || { u: 0, v: 0 };
    const phase = (descriptors.length * Math.PI) / 16;
    descriptors.push(Math.sin(p.u * 6.28 + phase) * Math.cos(p.v * 4.71 - phase));
  }

  return descriptors;
}


/**
 * Synthetic Face Generator for Evaluation
 * Creates realistic facial keypoint structures with natural intra-class biometric variations
 */
function createSyntheticFace(params: {
  cx: number;
  cy: number;
  faceWidth: number;
  faceHeight: number;
  ipdRatio: number;
  noseRatio: number;
  mouthRatio: number;
  jawVariation: number;
  rollAngleDeg?: number;
  expressionSmile?: number;
}): FaceDetectionData {
  const { cx, cy, faceWidth, faceHeight, ipdRatio, noseRatio, mouthRatio, jawVariation, rollAngleDeg = 0, expressionSmile = 0 } = params;

  const halfW = faceWidth / 2;
  const halfH = faceHeight / 2;
  const rad = (rollAngleDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const rotate = (px: number, py: number): { x: number; y: number } => {
    const rx = px - cx;
    const ry = py - cy;
    return {
      x: cx + rx * cosR - ry * sinR,
      y: cy + rx * sinR + ry * cosR,
    };
  };

  const leftEyeRaw = { x: cx - halfW * ipdRatio, y: cy - halfH * 0.2 };
  const rightEyeRaw = { x: cx + halfW * ipdRatio, y: cy - halfH * 0.2 };
  const noseRaw = { x: cx, y: cy + halfH * (noseRatio - 0.5) };
  const mouthLeftRaw = { x: cx - halfW * mouthRatio * 0.6, y: cy + halfH * 0.45 - expressionSmile * 4 };
  const mouthRightRaw = { x: cx + halfW * mouthRatio * 0.6, y: cy + halfH * 0.45 - expressionSmile * 4 };
  const mouthBottomRaw = { x: cx, y: cy + halfH * 0.58 };
  const leftCheekRaw = { x: cx - halfW * 0.65, y: cy + halfH * 0.1 };
  const rightCheekRaw = { x: cx + halfW * 0.65, y: cy + halfH * 0.1 };

  // Face contour oval
  const faceContour: { x: number; y: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const ang = (i * 2 * Math.PI) / 24;
    const rW = halfW * (1 + Math.sin(ang * 2) * jawVariation);
    const rH = halfH;
    const px = cx + rW * Math.cos(ang);
    const py = cy + rH * Math.sin(ang);
    faceContour.push(rotate(px, py));
  }

  return {
    bounds: {
      x: cx - halfW,
      y: cy - halfH,
      width: faceWidth,
      height: faceHeight,
    },
    rollAngle: rollAngleDeg,
    pitchAngle: 0,
    yawAngle: 0,
    leftEyeOpenProbability: 0.95,
    rightEyeOpenProbability: 0.95,
    landmarks: {
      LEFT_EYE: rotate(leftEyeRaw.x, leftEyeRaw.y),
      RIGHT_EYE: rotate(rightEyeRaw.x, rightEyeRaw.y),
      NOSE_BASE: rotate(noseRaw.x, noseRaw.y),
      MOUTH_LEFT: rotate(mouthLeftRaw.x, mouthLeftRaw.y),
      MOUTH_RIGHT: rotate(mouthRightRaw.x, mouthRightRaw.y),
      MOUTH_BOTTOM: rotate(mouthBottomRaw.x, mouthBottomRaw.y),
      LEFT_CHEEK: rotate(leftCheekRaw.x, leftCheekRaw.y),
      RIGHT_CHEEK: rotate(rightCheekRaw.x, rightCheekRaw.y),
    },
    contours: {
      FACE: faceContour,
    },
  };
}

function getEmbedding(face: FaceDetectionData): number[] {
  const g = extractLandmarkGeometry(face);
  return Array.from(normalizeZeroMeanL2(g));
}

// Invert face vertically to simulate the -180 degree alignment defect
function createInvertedFace(face: FaceDetectionData): FaceDetectionData {
  const cx = face.bounds.x + face.bounds.width / 2;
  const cy = face.bounds.y + face.bounds.height / 2;

  const invertPt = (pt?: { x: number; y: number }) => {
    if (!pt) return { x: cx, y: cy };
    return {
      x: cx - (pt.x - cx),
      y: cy - (pt.y - cy),
    };
  };

  const invertedLandmarks: Record<string, { x: number; y: number }> = {};
  for (const [k, v] of Object.entries(face.landmarks || {})) {
    invertedLandmarks[k] = invertPt(v);
  }

  const invertedContours: Record<string, { x: number; y: number }[]> = {};
  for (const [k, v] of Object.entries(face.contours || {})) {
    invertedContours[k] = v.map(invertPt);
  }

  return {
    ...face,
    landmarks: invertedLandmarks,
    contours: invertedContours,
  };
}

console.log('================================================================');
console.log('STEP 5 & 6: BIOMETRIC SIMILARITY DISTRIBUTION & THRESHOLD AUDIT');
console.log('================================================================\n');

// 1. Generate 10 Distinct Subject Identities (Ground Truth)
interface SubjectProfile {
  id: string;
  ipdRatio: number;
  noseRatio: number;
  mouthRatio: number;
  jawVariation: number;
}

const subjects: SubjectProfile[] = [
  { id: 'Emp_01', ipdRatio: 0.40, noseRatio: 0.52, mouthRatio: 0.55, jawVariation: 0.05 },
  { id: 'Emp_02', ipdRatio: 0.46, noseRatio: 0.58, mouthRatio: 0.62, jawVariation: 0.08 },
  { id: 'Emp_03', ipdRatio: 0.38, noseRatio: 0.48, mouthRatio: 0.48, jawVariation: 0.02 },
  { id: 'Emp_04', ipdRatio: 0.44, noseRatio: 0.55, mouthRatio: 0.58, jawVariation: 0.06 },
  { id: 'Emp_05', ipdRatio: 0.42, noseRatio: 0.50, mouthRatio: 0.52, jawVariation: 0.04 },
  { id: 'Emp_06', ipdRatio: 0.48, noseRatio: 0.60, mouthRatio: 0.65, jawVariation: 0.09 },
  { id: 'Emp_07', ipdRatio: 0.36, noseRatio: 0.46, mouthRatio: 0.45, jawVariation: 0.01 },
  { id: 'Emp_08', ipdRatio: 0.43, noseRatio: 0.53, mouthRatio: 0.54, jawVariation: 0.05 },
  { id: 'Emp_09', ipdRatio: 0.45, noseRatio: 0.56, mouthRatio: 0.60, jawVariation: 0.07 },
  { id: 'Emp_10', ipdRatio: 0.39, noseRatio: 0.49, mouthRatio: 0.50, jawVariation: 0.03 },
];

// Baseline enrollment embeddings (Canonical Upright)
const enrollmentTemplates = new Map<string, number[]>();
for (const s of subjects) {
  const enrollFace = createSyntheticFace({
    cx: 240, cy: 320, faceWidth: 200, faceHeight: 260,
    ipdRatio: s.ipdRatio, noseRatio: s.noseRatio, mouthRatio: s.mouthRatio, jawVariation: s.jawVariation,
  });
  enrollmentTemplates.set(s.id, getEmbedding(enrollFace));
}

// 2. Measure Genuine Comparisons (Same subject under various real-world conditions)
// Conditions: natural pose, slight smile, head roll (-12 to +12 deg), distance changes
const genuineScores: number[] = [];
const genuineDetails: { subject: string; condition: string; score: number }[] = [];

for (const s of subjects) {
  const ref = enrollmentTemplates.get(s.id)!;

  // Condition A: Ideal re-test
  const faceA = createSyntheticFace({
    cx: 242, cy: 318, faceWidth: 198, faceHeight: 258,
    ipdRatio: s.ipdRatio, noseRatio: s.noseRatio, mouthRatio: s.mouthRatio, jawVariation: s.jawVariation,
  });
  const scoreA = LocalFaceMatcher.calculateCosineSimilarity(getEmbedding(faceA), ref);
  genuineScores.push(scoreA);
  genuineDetails.push({ subject: s.id, condition: 'Ideal Re-test', score: scoreA });

  // Condition B: Slight smile / expression
  const faceB = createSyntheticFace({
    cx: 240, cy: 320, faceWidth: 200, faceHeight: 260,
    ipdRatio: s.ipdRatio, noseRatio: s.noseRatio, mouthRatio: s.mouthRatio, jawVariation: s.jawVariation,
    expressionSmile: 1.0,
  });
  const scoreB = LocalFaceMatcher.calculateCosineSimilarity(getEmbedding(faceB), ref);
  genuineScores.push(scoreB);
  genuineDetails.push({ subject: s.id, condition: 'Slight Smile', score: scoreB });

  // Condition C: Head Roll +10 degrees
  const faceC = createSyntheticFace({
    cx: 240, cy: 320, faceWidth: 200, faceHeight: 260,
    ipdRatio: s.ipdRatio, noseRatio: s.noseRatio, mouthRatio: s.mouthRatio, jawVariation: s.jawVariation,
    rollAngleDeg: 10,
  });
  const scoreC = LocalFaceMatcher.calculateCosineSimilarity(getEmbedding(faceC), ref);
  genuineScores.push(scoreC);
  genuineDetails.push({ subject: s.id, condition: 'Head Tilt +10°', score: scoreC });

  // Condition D: Head Roll -10 degrees
  const faceD = createSyntheticFace({
    cx: 240, cy: 320, faceWidth: 200, faceHeight: 260,
    ipdRatio: s.ipdRatio, noseRatio: s.noseRatio, mouthRatio: s.mouthRatio, jawVariation: s.jawVariation,
    rollAngleDeg: -10,
  });
  const scoreD = LocalFaceMatcher.calculateCosineSimilarity(getEmbedding(faceD), ref);
  genuineScores.push(scoreD);
  genuineDetails.push({ subject: s.id, condition: 'Head Tilt -10°', score: scoreD });

  // Condition E: Distance variation (closer/further, 20% size diff)
  const faceE = createSyntheticFace({
    cx: 250, cy: 310, faceWidth: 230, faceHeight: 295,
    ipdRatio: s.ipdRatio, noseRatio: s.noseRatio, mouthRatio: s.mouthRatio, jawVariation: s.jawVariation,
  });
  const scoreE = LocalFaceMatcher.calculateCosineSimilarity(getEmbedding(faceE), ref);
  genuineScores.push(scoreE);
  genuineDetails.push({ subject: s.id, condition: 'Distance/Scale Shift', score: scoreE });
}

// 3. Measure Impostor Comparisons (Different subjects cross-matched)
const impostorScores: number[] = [];
for (let i = 0; i < subjects.length; i++) {
  const ref = enrollmentTemplates.get(subjects[i].id)!;
  for (let j = 0; j < subjects.length; j++) {
    if (i !== j) {
      const impFace = createSyntheticFace({
        cx: 240, cy: 320, faceWidth: 200, faceHeight: 260,
        ipdRatio: subjects[j].ipdRatio, noseRatio: subjects[j].noseRatio, mouthRatio: subjects[j].mouthRatio, jawVariation: subjects[j].jawVariation,
      });
      const score = LocalFaceMatcher.calculateCosineSimilarity(getEmbedding(impFace), ref);
      impostorScores.push(score);
    }
  }
}

// 4. Measure Defective Inverted Comparison (What happened before Step 1 fix)
const invertedScores: number[] = [];
for (const s of subjects) {
  const ref = enrollmentTemplates.get(s.id)!;
  const normalFace = createSyntheticFace({
    cx: 240, cy: 320, faceWidth: 200, faceHeight: 260,
    ipdRatio: s.ipdRatio, noseRatio: s.noseRatio, mouthRatio: s.mouthRatio, jawVariation: s.jawVariation,
  });
  const invertedFace = createInvertedFace(normalFace);
  const score = LocalFaceMatcher.calculateCosineSimilarity(getEmbedding(invertedFace), ref);
  invertedScores.push(score);
}

// Helper statistics
function stats(arr: number[]) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  return { mean, min, max, std, n };
}

const gStats = stats(genuineScores);
const iStats = stats(impostorScores);
const invStats = stats(invertedScores);

console.log('--- STATISTICAL DISTRIBUTION SUMMARY ---');
console.log(`Genuine Pairs (N=${gStats.n}):   Mean=${gStats.mean.toFixed(4)}, Min=${gStats.min.toFixed(4)}, Max=${gStats.max.toFixed(4)}, Std=${gStats.std.toFixed(4)}`);
console.log(`Impostor Pairs (N=${iStats.n}):  Mean=${iStats.mean.toFixed(4)}, Min=${iStats.min.toFixed(4)}, Max=${iStats.max.toFixed(4)}, Std=${iStats.std.toFixed(4)}`);
console.log(`Inverted Pairs (N=${invStats.n}):  Mean=${invStats.mean.toFixed(4)}, Min=${invStats.min.toFixed(4)}, Max=${invStats.max.toFixed(4)}, Std=${invStats.std.toFixed(4)}\n`);

// 5. Evaluate Threshold Performance (FAR vs FRR)
const candidateThresholds = [0.68, 0.65, 0.60, 0.55, 0.50, 0.45, 0.363];

console.log('--- THRESHOLD DECISION MATRIX ---');
console.log('Threshold | FAR (False Acceptance) | FRR (False Rejection) | Inverted Match Rate');
console.log('---------------------------------------------------------------------------------');

for (const t of candidateThresholds) {
  const falseAccepts = impostorScores.filter((s) => s >= t).length;
  const far = (falseAccepts / impostorScores.length) * 100;

  const falseRejects = genuineScores.filter((s) => s < t).length;
  const frr = (falseRejects / genuineScores.length) * 100;

  const invertedMatches = invertedScores.filter((s) => s >= t).length;
  const invRate = (invertedMatches / invertedScores.length) * 100;

  console.log(
    `  ${t.toFixed(3)}   |        ${far.toFixed(2).padStart(5)}%          |        ${frr.toFixed(2).padStart(5)}%          |        ${invRate.toFixed(2).padStart(5)}%`
  );
}

console.log('\n--- SAMPLE GENUINE MATCH BREAKDOWN AT 0.68 THRESHOLD ---');
for (const detail of genuineDetails.slice(0, 10)) {
  const pass = detail.score >= 0.68 ? 'PASS' : 'FAIL (FALSE REJECTION)';
  console.log(`  [${detail.subject}] ${detail.condition.padEnd(22)}: Score = ${detail.score.toFixed(4)} -> ${pass}`);
}
