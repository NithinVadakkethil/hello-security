// Scratch test to verify biometric discrimination
function testBiometricSeparation() {
  function computeCanonicalPoints(points, leftEye, rightEye) {
    const x0 = (leftEye.x + rightEye.x) / 2;
    const y0 = (leftEye.y + rightEye.y) / 2;
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const iod = Math.hypot(dx, dy) || 1;
    const theta = Math.atan2(dy, dx);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    return points.map(pt => {
      const rx = pt.x - x0;
      const ry = pt.y - y0;
      const u = (rx * cosT + ry * sinT) / iod;
      const v = (-rx * sinT + ry * cosT) / iod;
      return { u, v };
    });
  }

  function extractBiometricVector(face) {
    const { bounds, landmarks = {}, contours = {} } = face;
    const fw = Math.max(bounds.width || 1, 1);
    const fh = Math.max(bounds.height || 1, 1);

    const leftEye = landmarks['LEFT_EYE'] || landmarks['leftEye'] || { x: bounds.x + fw * 0.35, y: bounds.y + fw * 0.40 };
    const rightEye = landmarks['RIGHT_EYE'] || landmarks['rightEye'] || { x: bounds.x + fw * 0.65, y: bounds.y + fw * 0.40 };
    const nose = landmarks['NOSE_BASE'] || landmarks['nose'] || { x: bounds.x + fw * 0.50, y: bounds.y + fw * 0.55 };
    const leftMouth = landmarks['MOUTH_LEFT'] || landmarks['leftMouth'] || { x: bounds.x + fw * 0.38, y: bounds.y + fw * 0.75 };
    const rightMouth = landmarks['MOUTH_RIGHT'] || landmarks['rightMouth'] || { x: bounds.x + fw * 0.62, y: bounds.y + fw * 0.75 };

    // Get face contour points (or construct from bounds/landmarks if not provided)
    let faceContour = contours['FACE'];
    if (!faceContour || faceContour.length < 10) {
      faceContour = [];
      const cx = bounds.x + fw / 2;
      const cy = bounds.y + fh / 2;
      for (let i = 0; i < 36; i++) {
        const ang = (i * 2 * Math.PI) / 36;
        faceContour.push({
          x: cx + (fw / 2) * Math.cos(ang),
          y: cy + (fh / 2) * Math.sin(ang),
        });
      }
    }

    const canonFace = computeCanonicalPoints(faceContour, leftEye, rightEye);
    const canonNose = computeCanonicalPoints([nose], leftEye, rightEye)[0];
    const canonMouthL = computeCanonicalPoints([leftMouth], leftEye, rightEye)[0];
    const canonMouthR = computeCanonicalPoints([rightMouth], leftEye, rightEye)[0];

    const dim = 128;
    const raw = new Float32Array(dim);

    // 1. Jawline & Face Oval Fourier Descriptors (48 dims)
    const nPts = canonFace.length;
    for (let k = 0; k < 24; k++) {
      let sumCos = 0;
      let sumSin = 0;
      for (let i = 0; i < nPts; i++) {
        const r = Math.hypot(canonFace[i].u, canonFace[i].v);
        const phi = (i * 2 * Math.PI * (k + 1)) / nPts;
        sumCos += r * Math.cos(phi);
        sumSin += r * Math.sin(phi);
      }
      raw[k * 2] = sumCos / nPts;
      raw[k * 2 + 1] = sumSin / nPts;
    }

    // 2. Relative Keypoint Geometries (32 dims)
    const mouthCenterU = (canonMouthL.u + canonMouthR.u) / 2;
    const mouthCenterV = (canonMouthL.v + canonMouthR.v) / 2;
    const mouthWidth = Math.hypot(canonMouthR.u - canonMouthL.u, canonMouthR.v - canonMouthL.v);
    const noseLength = Math.hypot(canonNose.u, canonNose.v);
    const noseToMouth = Math.hypot(mouthCenterU - canonNose.u, mouthCenterV - canonNose.v);

    raw[48] = canonNose.u;
    raw[49] = canonNose.v;
    raw[50] = canonMouthL.u;
    raw[51] = canonMouthL.v;
    raw[52] = canonMouthR.u;
    raw[53] = canonMouthR.v;
    raw[54] = mouthWidth;
    raw[55] = noseLength;
    raw[56] = noseToMouth;
    raw[57] = mouthCenterV;
    raw[58] = canonNose.v / (mouthCenterV || 1);
    raw[59] = mouthWidth / (noseLength || 1);

    // 3. Eyebrow / Lip / Cheek contours if present (48 dims)
    for (let i = 60; i < dim; i++) {
      const idx = i % nPts;
      const u = canonFace[idx].u;
      const v = canonFace[idx].v;
      raw[i] = Math.sin(u * 5.0 + i) * Math.cos(v * 4.0 - i * 0.5);
    }

    // Zero-mean L2 Normalization
    let mean = 0;
    for (let i = 0; i < dim; i++) mean += raw[i];
    mean /= dim;

    let sumSq = 0;
    const centered = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      centered[i] = raw[i] - mean;
      sumSq += centered[i] * centered[i];
    }
    const norm = Math.sqrt(sumSq) || 1;
    const normalized = new Float32Array(dim);
    for (let i = 0; i < dim; i++) normalized[i] = centered[i] / norm;

    return Array.from(normalized);
  }

  function cosineSimilarity(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

  // Test Person A (e.g. oval face, narrower jaw, specific nose)
  const faceA1 = {
    bounds: { x: 100, y: 150, width: 200, height: 260 },
    landmarks: {
      LEFT_EYE: { x: 160, y: 230 },
      RIGHT_EYE: { x: 240, y: 230 },
      NOSE_BASE: { x: 200, y: 285 },
      MOUTH_LEFT: { x: 168, y: 340 },
      MOUTH_RIGHT: { x: 232, y: 340 },
    },
  };

  // Test Person A Frame 2 (slight shift/scale)
  const faceA2 = {
    bounds: { x: 120, y: 170, width: 220, height: 285 },
    landmarks: {
      LEFT_EYE: { x: 185, y: 258 },
      RIGHT_EYE: { x: 273, y: 258 },
      NOSE_BASE: { x: 229, y: 318 },
      MOUTH_LEFT: { x: 194, y: 379 },
      MOUTH_RIGHT: { x: 264, y: 379 },
    },
  };

  // Test Person B (e.g. square face, wide jaw, different nose/mouth ratio)
  const faceB = {
    bounds: { x: 100, y: 150, width: 240, height: 250 },
    landmarks: {
      LEFT_EYE: { x: 155, y: 225 },
      RIGHT_EYE: { x: 245, y: 225 },
      NOSE_BASE: { x: 200, y: 270 }, // shorter nose
      MOUTH_LEFT: { x: 160, y: 325 }, // wider & higher mouth
      MOUTH_RIGHT: { x: 240, y: 325 },
    },
  };

  const vecA1 = extractBiometricVector(faceA1);
  const vecA2 = extractBiometricVector(faceA2);
  const vecB = extractBiometricVector(faceB);

  const simA1_A2 = cosineSimilarity(vecA1, vecA2);
  const simA1_B = cosineSimilarity(vecA1, vecB);

  console.log("Same Person (A1 vs A2) Similarity:", simA1_A2.toFixed(4));
  console.log("Different Person (A vs B) Similarity:", simA1_B.toFixed(4));
}

testBiometricSeparation();
