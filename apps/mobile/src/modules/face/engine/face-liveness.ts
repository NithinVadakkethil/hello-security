import { FaceDetectionData } from './face-quality';

export type LivenessChallengeType = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT';

export interface LivenessStatus {
  challengeType: LivenessChallengeType;
  instructions: string;
  isCompleted: boolean;
  progressRatio: number; // 0.0 to 1.0
}

export class FaceLivenessValidator {
  static CUSTOM_LIVENESS_PRODUCTION_READY = true;

  private currentChallenge: LivenessChallengeType = 'BLINK';
  private challengeStep: 'INITIAL' | 'IN_PROGRESS' | 'PASSED' = 'INITIAL';
  private challengeStartTime = 0;
  private closedStartTime = 0;
  private openBaseline = 0.85;
  private readonly TIMEOUT_MS = 8000;

  /**
   * Reset or start a new randomized liveness challenge
   */
  startChallenge(forceType?: LivenessChallengeType): LivenessStatus {
    const challenges: LivenessChallengeType[] = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT'];
    this.currentChallenge =
      forceType || challenges[Math.floor(Math.random() * challenges.length)];
    this.challengeStep = 'INITIAL';
    this.challengeStartTime = Date.now();
    this.closedStartTime = 0;
    this.openBaseline = 0.85;

    return this.getStatus();
  }

  /**
   * Process a frame and evaluate challenge progress
   */
  processFrame(face: FaceDetectionData): LivenessStatus {
    if (this.challengeStep === 'PASSED') {
      return this.getStatus();
    }

    const now = Date.now();
    if (now - this.challengeStartTime > this.TIMEOUT_MS) {
      // Timeout: restart challenge
      this.startChallenge(this.currentChallenge);
      return this.getStatus();
    }

    const leftEyeProb = face.leftEyeOpenProbability ?? 0.9;
    const rightEyeProb = face.rightEyeOpenProbability ?? 0.9;
    const yaw = face.yawAngle ?? 0;

    switch (this.currentChallenge) {
      case 'BLINK': {
        // Temporal sequence: Eyes Open (>=0.55) -> Eyes Closed (<=0.38) -> Eyes Re-opened (>=0.55)
        const avgEyeProb = (leftEyeProb + rightEyeProb) / 2;

        if (this.challengeStep === 'INITIAL') {
          if (avgEyeProb >= 0.55) {
            this.openBaseline = Math.max(this.openBaseline, avgEyeProb);
            this.challengeStep = 'IN_PROGRESS';
          }
        } else if (this.challengeStep === 'IN_PROGRESS') {
          // Closed state detection (with glasses / lighting delta tolerance)
          const isClosed =
            avgEyeProb <= 0.38 ||
            (leftEyeProb <= 0.35 && rightEyeProb <= 0.35) ||
            (this.openBaseline - avgEyeProb >= 0.35);

          if (isClosed && this.closedStartTime === 0) {
            this.closedStartTime = now;
          } else if (this.closedStartTime > 0) {
            const closedDuration = now - this.closedStartTime;
            // Eyes re-opened after validated closure
            if (avgEyeProb >= 0.55 && closedDuration <= 2500) {
              this.challengeStep = 'PASSED';
            } else if (closedDuration > 2500) {
              // Too long closed (>2.5s) - reset to initial to require a natural blink
              this.closedStartTime = 0;
              this.challengeStep = 'INITIAL';
            }
          }
        }
        break;
      }

      case 'TURN_LEFT': {
        // Yaw angle check: Yaw > 12° to left
        if (this.challengeStep === 'INITIAL' && Math.abs(yaw) < 8) {
          this.challengeStep = 'IN_PROGRESS';
        } else if (this.challengeStep === 'IN_PROGRESS' && yaw > 12) {
          this.challengeStep = 'PASSED';
        }
        break;
      }

      case 'TURN_RIGHT': {
        // Yaw angle check: Yaw < -12° to right
        if (this.challengeStep === 'INITIAL' && Math.abs(yaw) < 8) {
          this.challengeStep = 'IN_PROGRESS';
        } else if (this.challengeStep === 'IN_PROGRESS' && yaw < -12) {
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
    if (this.challengeStep === 'IN_PROGRESS') {
      progressRatio = this.closedStartTime > 0 ? 0.75 : 0.4;
    }
    if (this.challengeStep === 'PASSED') {
      progressRatio = 1.0;
    }

    return {
      challengeType: this.currentChallenge,
      instructions,
      isCompleted: this.challengeStep === 'PASSED',
      progressRatio,
    };
  }
}
