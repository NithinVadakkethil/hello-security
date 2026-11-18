import { FaceLivenessValidator } from '../face-liveness';
import { FaceDetectionData } from '../face-quality';

describe('FaceLivenessValidator Unit & Security Tests', () => {
  let validator: FaceLivenessValidator;

  const createFace = (leftProb: number, rightProb: number, yaw = 0): FaceDetectionData => ({
    bounds: { x: 100, y: 100, width: 200, height: 200 },
    leftEyeOpenProbability: leftProb,
    rightEyeOpenProbability: rightProb,
    yawAngle: yaw,
    rollAngle: 0,
    pitchAngle: 0,
  });

  beforeEach(() => {
    validator = new FaceLivenessValidator();
  });

  test('Static open eyes (photo attack) does not pass blink challenge', () => {
    validator.startChallenge('BLINK');
    const openFace = createFace(0.95, 0.95);

    for (let i = 0; i < 20; i++) {
      const status = validator.processFrame(openFace);
      expect(status.isCompleted).toBe(false);
    }
  });

  test('Static closed eyes (photo attack) does not pass blink challenge', () => {
    validator.startChallenge('BLINK');
    const closedFace = createFace(0.05, 0.05);

    for (let i = 0; i < 20; i++) {
      const status = validator.processFrame(closedFace);
      expect(status.isCompleted).toBe(false);
    }
  });

  test('Normal natural blink passes successfully (open -> closed -> open)', () => {
    validator.startChallenge('BLINK');

    // 1. Initial open eyes
    let status = validator.processFrame(createFace(0.9, 0.9));
    expect(status.isCompleted).toBe(false);

    // 2. Closed eyes (blink)
    status = validator.processFrame(createFace(0.15, 0.15));
    expect(status.isCompleted).toBe(false);

    // 3. Eyes re-open
    status = validator.processFrame(createFace(0.85, 0.85));
    expect(status.isCompleted).toBe(true);
  });

  test('Blink with glasses / partial closure (open -> 0.32 -> open) passes', () => {
    validator.startChallenge('BLINK');

    validator.processFrame(createFace(0.85, 0.85));
    validator.processFrame(createFace(0.32, 0.30));
    const status = validator.processFrame(createFace(0.80, 0.80));

    expect(status.isCompleted).toBe(true);
  });

  test('Turn Left challenge passes when yaw angle exceeds threshold', () => {
    validator.startChallenge('TURN_LEFT');

    // Straight
    let status = validator.processFrame(createFace(0.9, 0.9, 0));
    expect(status.isCompleted).toBe(false);

    // Turning left (yaw > 12)
    status = validator.processFrame(createFace(0.9, 0.9, 16));
    expect(status.isCompleted).toBe(true);
  });

  test('Turn Right challenge passes when yaw angle exceeds threshold', () => {
    validator.startChallenge('TURN_RIGHT');

    // Straight
    let status = validator.processFrame(createFace(0.9, 0.9, 0));
    expect(status.isCompleted).toBe(false);

    // Turning right (yaw < -12)
    status = validator.processFrame(createFace(0.9, 0.9, -16));
    expect(status.isCompleted).toBe(true);
  });
});
