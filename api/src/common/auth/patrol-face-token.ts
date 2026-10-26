import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';

function getJwtSecret(): string {
  return process.env.JWT_ACCESS_SECRET || 'hello-orbit-biometric-jwt-secret-min32chars';
}

export interface PatrolFaceAuthPayload {
  employeeId: string;
  assignmentId?: string | null;
  nonce: string;
  purpose: 'PATROL_START_FACE_VERIFIED';
}

// In-memory set of used nonces to prevent replay attacks (TTL 5 minutes)
const consumedNonces = new Map<string, number>();

function cleanupConsumedNonces(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of consumedNonces.entries()) {
    if (now > expiresAt) {
      consumedNonces.delete(nonce);
    }
  }
}

// Auto-cleanup every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupConsumedNonces, 60000).unref();
}

/**
 * Generates a short-lived, single-use signed authorization token for patrol initiation.
 * Valid for 3 minutes (180 seconds).
 */
export function generatePatrolFaceToken(employeeId: string, assignmentId?: string | null): string {
  const nonce = crypto.randomUUID();
  return jwt.sign(
    {
      employeeId,
      assignmentId: assignmentId || null,
      nonce,
      purpose: 'PATROL_START_FACE_VERIFIED',
    },
    getJwtSecret(),
    { expiresIn: '3m' },
  );
}

/**
 * Verifies and atomically consumes a patrol face authorization token.
 * Throws 403 Forbidden if expired, purpose invalid, mismatched employee/assignment, or replayed.
 */
export function verifyAndConsumePatrolFaceToken(
  token: string,
  expectedEmployeeId: string,
  expectedAssignmentId?: string | null,
): PatrolFaceAuthPayload {
  if (!token) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
      'Biometric face verification token is required to start a patrol.',
    );
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as PatrolFaceAuthPayload;

    if (
      !decoded ||
      decoded.purpose !== 'PATROL_START_FACE_VERIFIED' ||
      !decoded.employeeId ||
      !decoded.nonce
    ) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Invalid biometric authorization token purpose.',
      );
    }

    if (decoded.employeeId !== expectedEmployeeId) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Biometric authorization token does not belong to the authenticated employee.',
      );
    }

    if (
      expectedAssignmentId &&
      decoded.assignmentId &&
      decoded.assignmentId !== expectedAssignmentId
    ) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Biometric authorization was issued for a different patrol assignment.',
      );
    }

    // Anti-replay check
    if (consumedNonces.has(decoded.nonce)) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
        'Biometric authorization token has already been consumed (replay detected).',
      );
    }

    // Mark nonce as consumed for 5 minutes
    consumedNonces.set(decoded.nonce, Date.now() + 5 * 60 * 1000);

    return decoded;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
      'Invalid or expired biometric patrol authorization token.',
    );
  }
}
