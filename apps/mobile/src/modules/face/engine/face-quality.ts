export interface FaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionData {
  bounds: FaceBounds;
  rollAngle?: number;
  pitchAngle?: number;
  yawAngle?: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  landmarks?: Record<string, { x: number; y: number }>;
  contours?: Record<string, { x: number; y: number }[]>;
}

export type QualityResult =
  | { valid: true }
  | { valid: false; reason: QualityReason; message: string };

export type QualityReason =
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'TOO_FAR'
  | 'TOO_CLOSE'
  | 'OFF_CENTER'
  | 'BAD_POSE';

export class FaceQualityValidator {
  /**
   * Validate raw face detection frame against quality requirements
   * @param faces Array of faces detected in current frame
   * @param frameWidth Width of camera preview frame
   * @param frameHeight Height of camera preview frame
   */
  static validate(
    faces: FaceDetectionData[],
    frameWidth: number,
    frameHeight: number,
  ): QualityResult {
    if (!faces || faces.length === 0) {
      return {
        valid: false,
        reason: 'NO_FACE',
        message: 'Position face inside the oval frame',
      };
    }

    if (faces.length > 1) {
      return {
        valid: false,
        reason: 'MULTIPLE_FACES',
        message: 'Multiple faces detected. Ensure only 1 person is in view',
      };
    }

    const face = faces[0];
    const { width, height, x, y } = face.bounds;

    // Face Size check (relative to frame dimensions)
    const minSizeRatio = 0.22;
    const maxSizeRatio = 0.75;
    const faceSizeRatio = Math.max(width / frameWidth, height / frameHeight);

    if (faceSizeRatio < minSizeRatio) {
      return {
        valid: false,
        reason: 'TOO_FAR',
        message: 'Move closer to the camera',
      };
    }

    if (faceSizeRatio > maxSizeRatio) {
      return {
        valid: false,
        reason: 'TOO_CLOSE',
        message: 'Move back slightly',
      };
    }

    // Centering check (face center vs frame center)
    const faceCenterX = x + width / 2;
    const faceCenterY = y + height / 2;
    const frameCenterX = frameWidth / 2;
    const frameCenterY = frameHeight / 2;

    const offsetX = Math.abs(faceCenterX - frameCenterX) / frameWidth;
    const offsetY = Math.abs(faceCenterY - frameCenterY) / frameHeight;

    if (offsetX > 0.25 || offsetY > 0.25) {
      return {
        valid: false,
        reason: 'OFF_CENTER',
        message: 'Center your face inside the guide oval',
      };
    }

    // Head Pose / Orientation Check
    const maxAngle = 20; // max degrees deviation
    const roll = Math.abs(face.rollAngle || 0);
    const pitch = Math.abs(face.pitchAngle || 0);
    const yaw = Math.abs(face.yawAngle || 0);

    if (roll > maxAngle || pitch > maxAngle || yaw > maxAngle) {
      return {
        valid: false,
        reason: 'BAD_POSE',
        message: 'Look straight at the camera',
      };
    }

    return { valid: true };
  }
}
