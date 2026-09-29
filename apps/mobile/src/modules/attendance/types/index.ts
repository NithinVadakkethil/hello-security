export type AttendanceStatus = 'NOT_MARKED' | 'PRESENT' | 'PENDING_SYNC' | 'LATE' | 'COMPLETED';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  assignmentId: string;
  siteId: string;
  siteName?: string;
  shiftId: string;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  designation?: string;
  businessDate: string; // YYYY-MM-DD
  checkInAt: string; // ISO 8601 string
  checkOutAt?: string; // ISO 8601 string
  status: AttendanceStatus;
  verificationMethod: 'FACE_VERIFICATION';
  verificationResult: 'VERIFIED';
  isOfflineCaptured?: boolean;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarkAttendanceParams {
  employeeId: string;
  employeeName?: string;
  assignmentId: string;
  siteId: string;
  siteName?: string;
  shiftId: string;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  designation?: string;
  businessDate?: string;
  isConnected?: boolean;
}

export interface MarkCheckOutParams {
  employeeId: string;
  assignmentId: string;
  businessDate?: string;
  isConnected?: boolean;
}

