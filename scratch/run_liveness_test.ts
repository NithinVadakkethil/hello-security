import { FaceLivenessValidator } from '../apps/mobile/src/modules/face/engine/face-liveness';
import { FaceDetectionData } from '../apps/mobile/src/modules/face/engine/face-quality';

const createFace = (leftProb: number, rightProb: number, yaw = 0): FaceDetectionData => ({
  bounds: { x: 100, y: 100, width: 200, height: 200 },
  leftEyeOpenProbability: leftProb,
  rightEyeOpenProbability: rightProb,
  yawAngle: yaw,
  rollAngle: 0,
  pitchAngle: 0,
});

function assert(cond: boolean, msg: string) {
  if (!cond) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
}

console.log("=== RUNNING FaceLivenessValidator TESTS ===");

const validator = new FaceLivenessValidator();

// Test 1: Static open eyes (photo attack)
validator.startChallenge('BLINK');
for (let i = 0; i < 20; i++) {
  const status = validator.processFrame(createFace(0.95, 0.95));
  assert(!status.isCompleted, 'Static open eyes must NOT pass');
}
console.log("✓ Test 1: Static open eyes attack rejected");

// Test 2: Static closed eyes (photo attack)
validator.startChallenge('BLINK');
for (let i = 0; i < 20; i++) {
  const status = validator.processFrame(createFace(0.05, 0.05));
  assert(!status.isCompleted, 'Static closed eyes must NOT pass');
}
console.log("✓ Test 2: Static closed eyes attack rejected");

// Test 3: Normal natural blink (open -> closed -> open)
validator.startChallenge('BLINK');
let status = validator.processFrame(createFace(0.9, 0.9));
assert(!status.isCompleted, 'Initial open must not pass yet');
status = validator.processFrame(createFace(0.15, 0.15));
assert(!status.isCompleted, 'Closed phase must not pass yet');
status = validator.processFrame(createFace(0.85, 0.85));
assert(status.isCompleted, 'Reopened eyes must PASS');
console.log("✓ Test 3: Normal natural blink passed");

// Test 4: Blink with glasses / partial drop (0.85 -> 0.32 -> 0.85)
validator.startChallenge('BLINK');
validator.processFrame(createFace(0.85, 0.85));
validator.processFrame(createFace(0.32, 0.30));
status = validator.processFrame(createFace(0.80, 0.80));
assert(status.isCompleted, 'Partial drop with glasses must PASS');
console.log("✓ Test 4: Blink with glasses / partial drop passed");

// Test 5: Head turn left
validator.startChallenge('TURN_LEFT');
status = validator.processFrame(createFace(0.9, 0.9, 0));
assert(!status.isCompleted, 'Straight head must not pass turn left');
status = validator.processFrame(createFace(0.9, 0.9, 15));
assert(status.isCompleted, 'Turn left (yaw=15) must PASS');
console.log("✓ Test 5: Head turn left passed");

// Test 6: Head turn right
validator.startChallenge('TURN_RIGHT');
status = validator.processFrame(createFace(0.9, 0.9, 0));
assert(!status.isCompleted, 'Straight head must not pass turn right');
status = validator.processFrame(createFace(0.9, 0.9, -15));
assert(status.isCompleted, 'Turn right (yaw=-15) must PASS');
console.log("✓ Test 6: Head turn right passed");

console.log("\n ALL 6 FaceLivenessValidator TESTS PASSED 100%!");
