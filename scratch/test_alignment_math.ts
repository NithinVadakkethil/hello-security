/**
 * Reproduction & Verification Test for Landmark Alignment Mathematics
 * Compares current FaceImageModule.kt logic against expected canonical SFace alignment.
 */

// SFace canonical coordinates in 112x112 target image
const CANONICAL_LEFT_EYE_X = 38.2946;  // Viewer's left eye (X ~ 38)
const CANONICAL_LEFT_EYE_Y = 51.6963;
const CANONICAL_RIGHT_EYE_X = 73.5318; // Viewer's right eye (X ~ 73)
const CANONICAL_RIGHT_EYE_Y = 51.5014;

// Scenario 1: Normal, upright, unmirrored photo (Standard Android front camera capture)
// Subject is looking at the camera:
// - Subject's anatomical RIGHT eye is on the LEFT of the image (smaller X)
// - Subject's anatomical LEFT eye is on the RIGHT of the image (larger X)
const unmirroredLandmarks = {
  leftEye: { x: 400, y: 300 },   // Subject's left eye (viewer's right, x=400)
  rightEye: { x: 200, y: 300 },  // Subject's right eye (viewer's left, x=200)
};

function computeCurrentAlignment(leftEye: { x: number; y: number }, rightEye: { x: number; y: number }) {
  const srcDx = rightEye.x - leftEye.x;
  const srcDy = rightEye.y - leftEye.y;
  const srcDist = Math.hypot(srcDx, srcDy);

  const dstDx = CANONICAL_RIGHT_EYE_X - CANONICAL_LEFT_EYE_X;
  const dstDy = CANONICAL_RIGHT_EYE_Y - CANONICAL_LEFT_EYE_Y;
  const dstDist = Math.hypot(dstDx, dstDy);

  const scale = dstDist / (srcDist < 1 ? 1 : srcDist);
  const srcAngle = (Math.atan2(srcDy, srcDx) * 180) / Math.PI;
  const dstAngle = (Math.atan2(dstDy, dstDx) * 180) / Math.PI;
  const rotDeg = dstAngle - srcAngle;

  // Let's test where the nose (x=300, y=400) and chin (x=300, y=500) end up!
  const srcEyeCenterX = (leftEye.x + rightEye.x) / 2;
  const srcEyeCenterY = (leftEye.y + rightEye.y) / 2;
  const dstEyeCenterX = (CANONICAL_LEFT_EYE_X + CANONICAL_RIGHT_EYE_X) / 2;
  const dstEyeCenterY = (CANONICAL_LEFT_EYE_Y + CANONICAL_RIGHT_EYE_Y) / 2;

  // Function to transform a point (x, y) through the computed matrix:
  // 1. translate(-srcEyeCenterX, -srcEyeCenterY)
  // 2. rotate(rotDeg)
  // 3. scale(scale)
  // 4. translate(dstEyeCenterX, dstEyeCenterY)
  function transformPoint(px: number, py: number) {
    let tx = px - srcEyeCenterX;
    let ty = py - srcEyeCenterY;

    const rad = (rotDeg * Math.PI) / 180;
    const rx = tx * Math.cos(rad) - ty * Math.sin(rad);
    const ry = tx * Math.sin(rad) + ty * Math.cos(rad);

    const sx = rx * scale;
    const sy = ry * scale;

    return {
      x: sx + dstEyeCenterX,
      y: sy + dstEyeCenterY,
    };
  }

  const chinInSource = { x: 300, y: 500 }; // Chin is BELOW eyes in source (y=500 > y=300)
  const transformedChin = transformPoint(chinInSource.x, chinInSource.y);
  const transformedEyesCenter = transformPoint(srcEyeCenterX, srcEyeCenterY);

  return {
    srcDx,
    srcAngle,
    dstAngle,
    rotDeg,
    transformedEyesCenter,
    transformedChin,
    isChinBelowEyes: transformedChin.y > transformedEyesCenter.y,
  };
}

function computeCorrectedAlignment(leftEye: { x: number; y: number }, rightEye: { x: number; y: number }) {
  // Always determine viewer left eye (smaller X) and viewer right eye (larger X) in image space
  const viewerLeftEye = leftEye.x <= rightEye.x ? leftEye : rightEye;
  const viewerRightEye = leftEye.x <= rightEye.x ? rightEye : leftEye;

  const srcDx = viewerRightEye.x - viewerLeftEye.x;
  const srcDy = viewerRightEye.y - viewerLeftEye.y;
  const srcDist = Math.hypot(srcDx, srcDy);

  const dstDx = CANONICAL_RIGHT_EYE_X - CANONICAL_LEFT_EYE_X;
  const dstDy = CANONICAL_RIGHT_EYE_Y - CANONICAL_LEFT_EYE_Y;
  const dstDist = Math.hypot(dstDx, dstDy);

  const scale = dstDist / (srcDist < 1 ? 1 : srcDist);
  const srcAngle = (Math.atan2(srcDy, srcDx) * 180) / Math.PI;
  const dstAngle = (Math.atan2(dstDy, dstDx) * 180) / Math.PI;
  const rotDeg = dstAngle - srcAngle;

  const srcEyeCenterX = (viewerLeftEye.x + viewerRightEye.x) / 2;
  const srcEyeCenterY = (viewerLeftEye.y + viewerRightEye.y) / 2;
  const dstEyeCenterX = (CANONICAL_LEFT_EYE_X + CANONICAL_RIGHT_EYE_X) / 2;
  const dstEyeCenterY = (CANONICAL_LEFT_EYE_Y + CANONICAL_RIGHT_EYE_Y) / 2;

  function transformPoint(px: number, py: number) {
    let tx = px - srcEyeCenterX;
    let ty = py - srcEyeCenterY;

    const rad = (rotDeg * Math.PI) / 180;
    const rx = tx * Math.cos(rad) - ty * Math.sin(rad);
    const ry = tx * Math.sin(rad) + ty * Math.cos(rad);

    const sx = rx * scale;
    const sy = ry * scale;

    return {
      x: sx + dstEyeCenterX,
      y: sy + dstEyeCenterY,
    };
  }

  const chinInSource = { x: 300, y: 500 };
  const transformedChin = transformPoint(chinInSource.x, chinInSource.y);
  const transformedEyesCenter = transformPoint(srcEyeCenterX, srcEyeCenterY);

  return {
    srcDx,
    srcAngle,
    dstAngle,
    rotDeg,
    transformedEyesCenter,
    transformedChin,
    isChinBelowEyes: transformedChin.y > transformedEyesCenter.y,
  };
}

console.log("=== TESTING CURRENT FaceImageModule.kt ALIGNMENT ===");
const currentRes = computeCurrentAlignment(unmirroredLandmarks.leftEye, unmirroredLandmarks.rightEye);
console.log("Current rotDeg:", currentRes.rotDeg);
console.log("Current Transformed Chin Y:", currentRes.transformedChin.y, "Eyes Y:", currentRes.transformedEyesCenter.y);
console.log("Is chin below eyes in target crop?", currentRes.isChinBelowEyes ? "YES (Upright)" : "NO (UPSIDE DOWN!)");

console.log("\n=== TESTING CORRECTED FaceImageModule.kt ALIGNMENT ===");
const correctedRes = computeCorrectedAlignment(unmirroredLandmarks.leftEye, unmirroredLandmarks.rightEye);
console.log("Corrected rotDeg:", correctedRes.rotDeg);
console.log("Corrected Transformed Chin Y:", correctedRes.transformedChin.y, "Eyes Y:", correctedRes.transformedEyesCenter.y);
console.log("Is chin below eyes in target crop?", correctedRes.isChinBelowEyes ? "YES (Upright)" : "NO (UPSIDE DOWN!)");

console.log("\n=== TESTING HEAD TILT (+20 deg clockwise) ===");
const tiltedEye1 = { x: 210, y: 270 };
const tiltedEye2 = { x: 390, y: 335 };
const tiltRes = computeCorrectedAlignment(tiltedEye2, tiltedEye1); // leftEye=tiltedEye2 (x=390), rightEye=tiltedEye1 (x=210)
console.log("Tilt rotDeg:", tiltRes.rotDeg.toFixed(2), "deg");
console.log("Transformed Chin Y:", tiltRes.transformedChin.y.toFixed(2), "Eyes Y:", tiltRes.transformedEyesCenter.y.toFixed(2));
console.log("Is chin below eyes?", tiltRes.isChinBelowEyes ? "YES (Upright)" : "NO");

console.log("\n=== TESTING MIRRORED CAPTURE ===");
const mirroredLandmarks = {
  leftEye: { x: 200, y: 300 },   // Subject's left eye is on viewer's left in mirror
  rightEye: { x: 400, y: 300 },  // Subject's right eye is on viewer's right in mirror
};
const mirrorRes = computeCorrectedAlignment(mirroredLandmarks.leftEye, mirroredLandmarks.rightEye);
console.log("Mirror rotDeg:", mirrorRes.rotDeg.toFixed(2), "deg");
console.log("Transformed Chin Y:", mirrorRes.transformedChin.y.toFixed(2), "Eyes Y:", mirrorRes.transformedEyesCenter.y.toFixed(2));
console.log("Is chin below eyes?", mirrorRes.isChinBelowEyes ? "YES (Upright)" : "NO");


