import { FaceDetectionData } from './face-quality';

export type LivenessChallengeType = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT';

export interface LivenessStatus {
  challengeType: LivenessChallengeType;
  instructions: string;
  isCompleted: boolean;
  progressRatio: number; // 0.0 to 1.0
}

export class FaceLivenessValidator {
  static CUSTOM_LIVENESS_PRODUCTION_READY = false;

  private currentChallenge: LivenessChallengeType = 'BLINK';
  private challengeStep: 'INITIAL' | 'IN_PROGRESS' | 'PASSED' = 'INITIAL';
  private challengeStartTime = 0;
  private readonly TIMEOUT_MS = 5000;

  /**
   * Reset or start a new randomized liveness challenge
   */
  startChallenge(forceType?: LivenessChallengeType): LivenessStatus {
    const challenges: LivenessChallengeType[] = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT'];
    this.currentChallenge =
      forceType || challenges[Math.floor(Math.random() * challenges.length)];
    this.challengeStep = 'INITIAL';
    this.challengeStartTime = Date.now();

    return this.getStatus();
  }

  /**
   * Process a frame and evaluate challenge progress
   */
  processFrame(face: FaceDetectionData): LivenessStatus {
    if (this.challengeStep === 'PASSED') {
      return this.getStatus();
    }

    if (Date.now() - this.challengeStartTime > this.TIMEOUT_MS) {
      // Timeout: restart challenge
      this.startChallenge(this.currentChallenge);
      return this.getStatus();
    }

    const leftEyeProb = face.leftEyeOpenProbability ?? 0.9;
    const rightEyeProb = face.rightEyeOpenProbability ?? 0.9;
    const yaw = face.yawAngle ?? 0;

    switch (this.currentChallenge) {
      case 'BLINK': {
        // Temporal sequence: Eyes open (>0.6) -> Eyes closed (<0.25) -> Eyes open (>0.6)
        const avgEyeProb = (leftEyeProb + rightEyeProb) / 2;
        if (this.challengeStep === 'INITIAL') {
          if (avgEyeProb > 0.6) {
            this.challengeStep = 'IN_PROGRESS';
          }
        } else if (this.challengeStep === 'IN_PROGRESS') {
          if (avgEyeProb < 0.25) {
            this.challengeStep = 'PASSED';
          }
        }
        break;
      }

      case 'TURN_LEFT': {
        // Yaw angle check: Yaw > 15° to left
        if (this.challengeStep === 'INITIAL' && Math.abs(yaw) < 8) {
          this.challengeStep = 'IN_PROGRESS';
        } else if (this.challengeStep === 'IN_PROGRESS' && yaw > 14) {
          this.challengeStep = 'PASSED';
        }
        break;
      }

      case 'TURN_RIGHT': {
        // Yaw angle check: Yaw < -15° to right
        if (this.challengeStep === 'INITIAL' && Math.abs(yaw) < 8) {
          this.challengeStep = 'IN_PROGRESS';
        } else if (this.challengeStep === 'IN_PROGRESS' && yaw < -14) {
          this.challengeStep = 'PASSED';
        }
        break;
      }
    }

    return this.getStatus();
  }

  /**
   * Get current liveness status object
   */
  getStatus(): LivenessStatus {
    let instructions = '';
    switch (this.currentChallenge) {
      case 'BLINK':
        instructions = 'Blink your eyes naturally';
        break;
      case 'TURN_LEFT':
        instructions = 'Turn your head slightly to the left';
        break;
      case 'TURN_RIGHT':
        instructions = 'Turn your head slightly to the right';
        break;
    }

    let progressRatio = 0.0;
    if (this.challengeStep === 'IN_PROGRESS') progressRatio = 0.5;
    if (this.challengeStep === 'PASSED') progressRatio = 1.0;

    return {
      challengeType: this.currentChallenge,
      instructions,
      isCompleted: this.challengeStep === 'PASSED',
      progressRatio,
    };
  }
}
