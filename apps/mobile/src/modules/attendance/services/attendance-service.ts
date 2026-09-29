import { storage } from '../../../app/utils/mmkv-storage';
import { AttendanceRecord, MarkAttendanceParams } from '../types';

const STORAGE_PREFIX = 'hello_orbit_attendance_v1_';
const HISTORY_INDEX_KEY = 'hello_orbit_attendance_history_v1_';

export function getTodayBusinessDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildAttendanceStorageKey(
  employeeId: string,
  assignmentId: string,
  businessDate: string
): string {
  return `${STORAGE_PREFIX}${employeeId}_${assignmentId}_${businessDate}`;
}

export const attendanceService = {
  getTodayBusinessDate,
  
  getAttendance: (
    employeeId: string,
    assignmentId: string,
    businessDate: string = getTodayBusinessDate()
  ): AttendanceRecord | null => {
    if (!employeeId || !assignmentId) return null;
    const key = buildAttendanceStorageKey(employeeId, assignmentId, businessDate);
    try {
      const json = storage.getString(key);
      if (!json) return null;
      return JSON.parse(json) as AttendanceRecord;
    } catch (err) {
      console.warn('[AttendanceService] Failed to read attendance:', err);
      return null;
    }
  },

  markAttendance: (params: MarkAttendanceParams): AttendanceRecord => {
    const {
      employeeId,
      employeeName,
      assignmentId,
      siteId,
      siteName,
      shiftId,
      shiftName,
      shiftStartTime,
      shiftEndTime,
      designation,
      businessDate = getTodayBusinessDate(),
      isConnected = true,
    } = params;

    const key = buildAttendanceStorageKey(employeeId, assignmentId, businessDate);
    const existing = attendanceService.getAttendance(employeeId, assignmentId, businessDate);

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const idempotencyKey = `att_${employeeId}_${assignmentId}_${businessDate}`;
    const initialStatus = isConnected ? 'PRESENT' : 'PENDING_SYNC';

    const newRecord: AttendanceRecord = {
      id: `att_loc_${Date.now()}`,
      employeeId,
      employeeName,
      assignmentId,
      siteId,
      siteName,
      shiftId,
      shiftName,
      shiftStartTime,
      shiftEndTime,
      designation,
      businessDate,
      checkInAt: now,
      status: initialStatus,
      verificationMethod: 'FACE_VERIFICATION',
      verificationResult: 'VERIFIED',
      isOfflineCaptured: !isConnected,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    // Save specific record
    storage.set(key, JSON.stringify(newRecord));

    // Save to history index for this employee
    attendanceService.appendHistory(employeeId, newRecord);

    return newRecord;
  },

  getAttendanceHistory: (employeeId: string): AttendanceRecord[] => {
    if (!employeeId) return [];
    const indexKey = `${HISTORY_INDEX_KEY}${employeeId}`;
    try {
      const json = storage.getString(indexKey);
      if (!json) return [];
      const records = JSON.parse(json) as AttendanceRecord[];
      // Sort newest checkInAt first
      return records.sort(
        (a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime()
      );
    } catch (err) {
      console.warn('[AttendanceService] Failed to read history:', err);
      return [];
    }
  },

  appendHistory: (employeeId: string, record: AttendanceRecord) => {
    const indexKey = `${HISTORY_INDEX_KEY}${employeeId}`;
    const history = attendanceService.getAttendanceHistory(employeeId);
    const updated = [record, ...history.filter(r => r.idempotencyKey !== record.idempotencyKey)];
    // Limit history to 50 records
    const sliced = updated.slice(0, 50);
    storage.set(indexKey, JSON.stringify(sliced));
  },

  markCheckOut: (params: {
    employeeId: string;
    assignmentId: string;
    businessDate?: string;
    isConnected?: boolean;
  }): AttendanceRecord | null => {
    const {
      employeeId,
      assignmentId,
      businessDate = getTodayBusinessDate(),
      isConnected = true,
    } = params;

    if (!employeeId || !assignmentId) return null;

    const key = buildAttendanceStorageKey(employeeId, assignmentId, businessDate);
    const existing = attendanceService.getAttendance(employeeId, assignmentId, businessDate);

    if (!existing) {
      return null;
    }

    if (existing.checkOutAt) {
      return existing;
    }

    const now = new Date().toISOString();
    const updatedStatus = isConnected ? 'COMPLETED' : 'PENDING_SYNC';

    const updatedRecord: AttendanceRecord = {
      ...existing,
      checkOutAt: now,
      status: updatedStatus,
      updatedAt: now,
    };

    storage.set(key, JSON.stringify(updatedRecord));
    attendanceService.appendHistory(employeeId, updatedRecord);

    return updatedRecord;
  },

  clearUserAttendance: (employeeId: string) => {
    // Standard clear mechanism if required upon logout
  },
};
