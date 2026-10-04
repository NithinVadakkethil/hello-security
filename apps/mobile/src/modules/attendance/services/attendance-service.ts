import { storage } from '../../../app/utils/mmkv-storage';
import { apiClient } from '../../../app/api/api-client';
import { AttendanceRecord, AttendanceStatus, MarkAttendanceParams, MarkCheckOutParams } from '../types';

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
    assignmentId?: string,
    businessDate: string = getTodayBusinessDate()
  ): AttendanceRecord | null => {
    if (!employeeId) return null;
    const resolvedAssignmentId = assignmentId || 'direct';
    const key = buildAttendanceStorageKey(employeeId, resolvedAssignmentId, businessDate);
    try {
      let json = storage.getString(key);
      if (!json && resolvedAssignmentId !== 'direct') {
        json = storage.getString(buildAttendanceStorageKey(employeeId, 'direct', businessDate));
      }
      if (!json) return null;
      return JSON.parse(json) as AttendanceRecord;
    } catch (err) {
      console.warn('[AttendanceService] Failed to read attendance:', err);
      return null;
    }
  },

  markAttendance: async (params: MarkAttendanceParams): Promise<AttendanceRecord> => {
    const {
      employeeId,
      employeeName,
      assignmentId = 'direct',
      siteId = '',
      siteName,
      shiftId = '',
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

    let serverCheckInAt: string | null = null;
    let serverStatus: AttendanceStatus = isConnected ? 'PRESENT' : 'PENDING_SYNC';
    let serverRecordId = `att_loc_${Date.now()}`;

    if (isConnected) {
      try {
        const response: any = await apiClient.post('/attendance/check-in', {
          employeeId,
          assignmentId,
          siteId,
          shiftId,
          businessDate,
        });
        const attData = response?.data || response;
        if (attData?.checkInTimeRaw) {
          serverCheckInAt = attData.checkInTimeRaw;
          serverStatus = (attData.status as AttendanceStatus) || 'PRESENT';
          serverRecordId = attData.id || serverRecordId;
        }
      } catch (err) {
        console.warn('[AttendanceService] API check-in failed, storing offline:', err);
      }
    }

    const now = serverCheckInAt || new Date().toISOString();
    const idempotencyKey = `att_${employeeId}_${assignmentId}_${businessDate}`;

    const newRecord: AttendanceRecord = {
      id: serverRecordId,
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
      status: serverStatus,
      verificationMethod: 'FACE_VERIFICATION',
      verificationResult: 'VERIFIED',
      isOfflineCaptured: !isConnected,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    // Save specific record
    storage.set(key, JSON.stringify(newRecord));
    if (assignmentId !== 'direct') {
      storage.set(buildAttendanceStorageKey(employeeId, 'direct', businessDate), JSON.stringify(newRecord));
    }

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

  markCheckOut: async (params: {
    employeeId: string;
    assignmentId?: string;
    businessDate?: string;
    isConnected?: boolean;
  }): Promise<AttendanceRecord | null> => {
    const {
      employeeId,
      assignmentId,
      businessDate = getTodayBusinessDate(),
      isConnected = true,
    } = params;

    if (!employeeId) return null;
    const resolvedAssignmentId = assignmentId || 'direct';

    let existing = attendanceService.getAttendance(employeeId, resolvedAssignmentId, businessDate);
    if (!existing && resolvedAssignmentId !== 'direct') {
      existing = attendanceService.getAttendance(employeeId, 'direct', businessDate);
    }

    if (!existing) {
      return null;
    }

    if (existing.checkOutAt) {
      return existing;
    }

    let serverCheckOutAt: string | null = null;
    let serverStatus: AttendanceStatus = isConnected ? 'COMPLETED' : 'PENDING_SYNC';

    if (isConnected) {
      try {
        const response: any = await apiClient.post('/attendance/check-out', {
          employeeId,
          assignmentId: existing.assignmentId || resolvedAssignmentId,
          businessDate,
        });
        const attData = response?.data || response;
        if (attData?.checkOutTimeRaw) {
          serverCheckOutAt = attData.checkOutTimeRaw;
          serverStatus = (attData.status as AttendanceStatus) || 'COMPLETED';
        }
      } catch (err) {
        console.warn('[AttendanceService] API check-out failed, storing offline:', err);
      }
    }

    const now = serverCheckOutAt || new Date().toISOString();

    const updatedRecord: AttendanceRecord = {
      ...existing,
      checkOutAt: now,
      status: serverStatus,
      updatedAt: now,
    };

    const key = buildAttendanceStorageKey(employeeId, existing.assignmentId || resolvedAssignmentId, businessDate);
    storage.set(key, JSON.stringify(updatedRecord));
    if (existing.assignmentId !== 'direct') {
      storage.set(buildAttendanceStorageKey(employeeId, 'direct', businessDate), JSON.stringify(updatedRecord));
    }
    attendanceService.appendHistory(employeeId, updatedRecord);

    return updatedRecord;
  },

  fetchServerAttendance: async (
    employeeId: string,
    assignmentId?: string,
    businessDate: string = getTodayBusinessDate()
  ): Promise<AttendanceRecord | null> => {
    if (!employeeId) return null;
    const resolvedAssignmentId = assignmentId || 'direct';
    try {
      const response: any = await apiClient.get('/attendance', {
        params: {
          employeeId,
          date: businessDate,
        },
      });
      const records = response?.data?.records || response?.records || response?.data || [];
      const match = records.find(
        (r: any) => r.employeeId === employeeId && (r.date === businessDate || r.shiftDate === businessDate)
      );
      if (match && match.status !== 'OFF' && match.checkInTimeRaw) {
        const effectiveAsgId = match.assignmentId || resolvedAssignmentId;
        const key = buildAttendanceStorageKey(employeeId, effectiveAsgId, businessDate);
        const serverRecord: AttendanceRecord = {
          id: match.id,
          employeeId,
          employeeName: match.employeeName,
          assignmentId: effectiveAsgId,
          siteId: match.siteId || '',
          siteName: match.siteName || '',
          shiftId: match.shiftId || '',
          shiftName: match.shiftName || '',
          shiftStartTime: match.shiftStartTime || '',
          shiftEndTime: match.shiftEndTime || '',
          designation: match.employeeRole || '',
          businessDate,
          checkInAt: match.checkInTimeRaw,
          checkOutAt: match.checkOutTimeRaw || undefined,
          status: match.status,
          verificationMethod: match.verificationMethod || 'FACE_VERIFICATION',
          verificationResult: 'VERIFIED',
          isOfflineCaptured: false,
          idempotencyKey: `att_${employeeId}_${effectiveAsgId}_${businessDate}`,
          createdAt: match.createdAt || match.checkInTimeRaw,
          updatedAt: match.updatedAt || match.checkInTimeRaw,
        };
        storage.set(key, JSON.stringify(serverRecord));
        if (effectiveAsgId !== 'direct') {
          storage.set(buildAttendanceStorageKey(employeeId, 'direct', businessDate), JSON.stringify(serverRecord));
        }
        attendanceService.appendHistory(employeeId, serverRecord);
        return serverRecord;
      }
    } catch (err) {
      console.warn('[AttendanceService] Failed to fetch server attendance:', err);
    }
    return null;
  },

  syncPendingAttendance: async (
    employeeId: string,
    assignmentId: string,
    businessDate: string = getTodayBusinessDate()
  ): Promise<AttendanceRecord | null> => {
    if (!employeeId || !assignmentId) return null;
    const local = attendanceService.getAttendance(employeeId, assignmentId, businessDate);
    if (local && (local.isOfflineCaptured || local.status === 'PENDING_SYNC')) {
      try {
        const response: any = await apiClient.post('/attendance/check-in', {
          employeeId,
          assignmentId,
          siteId: local.siteId,
          shiftId: local.shiftId,
          businessDate,
        });
        const attData = response?.data || response;
        if (attData?.checkInTimeRaw) {
          const updated: AttendanceRecord = {
            ...local,
            id: attData.id || local.id,
            status: (attData.status as AttendanceStatus) || 'PRESENT',
            isOfflineCaptured: false,
          };
          const key = buildAttendanceStorageKey(employeeId, assignmentId, businessDate);
          storage.set(key, JSON.stringify(updated));
          attendanceService.appendHistory(employeeId, updated);
          return updated;
        }
      } catch (err) {
        console.warn('[AttendanceService] Sync check-in failed:', err);
      }
    }
    return local;
  },

  clearUserAttendance: (employeeId: string) => {
    // Standard clear mechanism if required upon logout
  },
};

