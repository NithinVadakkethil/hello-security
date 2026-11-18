import { storage } from '../../../app/utils/mmkv-storage';
import { apiClient } from '../../../app/api/api-client';
import { AttendanceRecord, AttendanceStatus, MarkAttendanceParams, MarkCheckOutParams } from '../types';
import { resolveEffectiveAttendanceDate } from '../utils/attendance-shift.util';

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
  
  /**
   * Shift-aware attendance lookup:
   * Prioritizes active in-progress attendance within 28h so that night-shift employees
   * remain Checked In across midnight and app restarts.
   */
  getAttendance: (
    employeeId: string,
    assignmentId?: string,
    businessDate?: string
  ): AttendanceRecord | null => {
    if (!employeeId) return null;
    const resolvedAssignmentId = assignmentId || 'direct';

    // If a specific businessDate was provided, query that directly
    if (businessDate) {
      const key = buildAttendanceStorageKey(employeeId, resolvedAssignmentId, businessDate);
      try {
        let json = storage.getString(key);
        if (!json && resolvedAssignmentId !== 'direct') {
          json = storage.getString(buildAttendanceStorageKey(employeeId, 'direct', businessDate));
        }
        if (json) return JSON.parse(json) as AttendanceRecord;
      } catch (err) {
        console.warn('[AttendanceService] Failed to read attendance:', err);
      }
      return null;
    }

    // Priority 1: Check for active in-progress attendance in history within the last 28 hours
    const history = attendanceService.getAttendanceHistory(employeeId);
    const nowMs = Date.now();
    const activeRecord = history.find((r) => {
      if (r.checkOutAt || r.status === 'COMPLETED') return false;
      const checkInMs = new Date(r.checkInAt).getTime();
      return !isNaN(checkInMs) && nowMs - checkInMs <= 28 * 60 * 60 * 1000;
    });

    if (activeRecord) {
      return activeRecord;
    }

    // Priority 2: Query today's business date
    const todayDate = getTodayBusinessDate();
    const key = buildAttendanceStorageKey(employeeId, resolvedAssignmentId, todayDate);
    try {
      let json = storage.getString(key);
      if (!json && resolvedAssignmentId !== 'direct') {
        json = storage.getString(buildAttendanceStorageKey(employeeId, 'direct', todayDate));
      }
      if (json) return JSON.parse(json) as AttendanceRecord;
    } catch (err) {
      console.warn('[AttendanceService] Failed to read attendance:', err);
    }

    return null;
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
      businessDate: passedBusinessDate,
      isConnected = true,
    } = params;

    // Shift-aware business date: night shifts starting after midnight map to yesterday's scheduled shift date
    const businessDate = passedBusinessDate || resolveEffectiveAttendanceDate(shiftStartTime, shiftEndTime);

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
      businessDate: passedBusinessDate,
      isConnected = true,
    } = params;

    if (!employeeId) return null;
    const resolvedAssignmentId = assignmentId || 'direct';

    // Shift-aware check-out: find active in-progress record across midnight
    let existing: AttendanceRecord | null = null;
    if (passedBusinessDate) {
      existing = attendanceService.getAttendance(employeeId, resolvedAssignmentId, passedBusinessDate) ||
                 attendanceService.getAttendance(employeeId, 'direct', passedBusinessDate);
    } else {
      const history = attendanceService.getAttendanceHistory(employeeId);
      const nowMs = Date.now();
      existing = history.find((r) => {
        if (r.checkOutAt || r.status === 'COMPLETED') return false;
        const checkInMs = new Date(r.checkInAt).getTime();
        return !isNaN(checkInMs) && nowMs - checkInMs <= 28 * 60 * 60 * 1000;
      }) || null;
    }

    if (!existing) {
      const todayDate = getTodayBusinessDate();
      existing = attendanceService.getAttendance(employeeId, resolvedAssignmentId, todayDate) ||
                 attendanceService.getAttendance(employeeId, 'direct', todayDate);
    }

    if (!existing) {
      return null;
    }

    if (existing.checkOutAt) {
      return existing;
    }

    const targetBusinessDate = existing.businessDate || passedBusinessDate || getTodayBusinessDate();

    let serverCheckOutAt: string | null = null;
    let serverStatus: AttendanceStatus = isConnected ? 'COMPLETED' : 'PENDING_SYNC';

    if (isConnected) {
      try {
        const response: any = await apiClient.post('/attendance/check-out', {
          employeeId,
          assignmentId: existing.assignmentId || resolvedAssignmentId,
          businessDate: targetBusinessDate,
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

    const key = buildAttendanceStorageKey(employeeId, existing.assignmentId || resolvedAssignmentId, targetBusinessDate);
    storage.set(key, JSON.stringify(updatedRecord));
    if (existing.assignmentId !== 'direct') {
      storage.set(buildAttendanceStorageKey(employeeId, 'direct', targetBusinessDate), JSON.stringify(updatedRecord));
    }
    attendanceService.appendHistory(employeeId, updatedRecord);

    return updatedRecord;
  },

  fetchServerAttendance: async (
    employeeId: string,
    assignmentId?: string,
    businessDate?: string
  ): Promise<AttendanceRecord | null> => {
    if (!employeeId) return null;
    const resolvedAssignmentId = assignmentId || 'direct';

    // If businessDate is not passed, check if there is an active in-progress record to sync
    const history = attendanceService.getAttendanceHistory(employeeId);
    const activeLocal = history.find((r) => !r.checkOutAt && r.status !== 'COMPLETED');
    const targetDate = businessDate || activeLocal?.businessDate || getTodayBusinessDate();

    try {
      const response: any = await apiClient.get('/attendance', {
        params: {
          employeeId,
          date: targetDate,
        },
      });
      const records = response?.data?.records || response?.records || response?.data || [];
      const match = records.find(
        (r: any) =>
          r.employeeId === employeeId &&
          (r.date === targetDate || r.shiftDate === targetDate || (r.status !== 'OFF' && !r.checkOutTimeRaw))
      );
      if (match && match.status !== 'OFF' && match.checkInTimeRaw) {
        const effectiveDate = match.shiftDate || match.date || targetDate;
        const effectiveAsgId = match.assignmentId || resolvedAssignmentId;
        const key = buildAttendanceStorageKey(employeeId, effectiveAsgId, effectiveDate);
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
          businessDate: effectiveDate,
          checkInAt: match.checkInTimeRaw,
          checkOutAt: match.checkOutTimeRaw || undefined,
          status: match.status,
          verificationMethod: match.verificationMethod || 'FACE_VERIFICATION',
          verificationResult: 'VERIFIED',
          isOfflineCaptured: false,
          idempotencyKey: `att_${employeeId}_${effectiveAsgId}_${effectiveDate}`,
          createdAt: match.createdAt || match.checkInTimeRaw,
          updatedAt: match.updatedAt || match.checkInTimeRaw,
        };
        storage.set(key, JSON.stringify(serverRecord));
        if (effectiveAsgId !== 'direct') {
          storage.set(buildAttendanceStorageKey(employeeId, 'direct', effectiveDate), JSON.stringify(serverRecord));
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
