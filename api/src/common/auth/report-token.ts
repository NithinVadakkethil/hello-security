import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/ErrorCodes';
import { HttpStatus } from '../errors/HttpStatus';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'secret';

export interface ReportTokenPayload {
  patrolSessionId: string;
  clientId: string;
  purpose: 'PATROL_REPORT_DOWNLOAD';
}

export function generateReportDownloadToken(patrolSessionId: string, clientId: string): string {
  return jwt.sign(
    {
      patrolSessionId,
      clientId,
      purpose: 'PATROL_REPORT_DOWNLOAD',
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function verifyReportDownloadToken(token: string): ReportTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ReportTokenPayload;
    if (!decoded || decoded.purpose !== 'PATROL_REPORT_DOWNLOAD' || !decoded.patrolSessionId) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        'Invalid report download token purpose.',
      );
    }
    return decoded;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
      'Invalid or expired report download token.',
    );
  }
}
