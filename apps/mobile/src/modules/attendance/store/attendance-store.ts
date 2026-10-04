import { create } from 'zustand';
import { AttendanceRecord, MarkAttendanceParams, MarkCheckOutParams } from '../types';
import { attendanceService, getTodayBusinessDate } from '../services/attendance-service';

interface AttendanceState {
  todayAttendance: AttendanceRecord | null;
  history: AttendanceRecord[];
  isLoading: boolean;
  loadAttendance: (employeeId: string, assignmentId: string) => void;
  markAttendance: (params: MarkAttendanceParams) => Promise<AttendanceRecord>;
  markCheckOut: (params: MarkCheckOutParams) => Promise<AttendanceRecord | null>;
  resetState: () => void;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  todayAttendance: null,
  history: [],
  isLoading: false,

  loadAttendance: (employeeId: string, assignmentId: string) => {
    if (!employeeId || !assignmentId) {
      set({ todayAttendance: null, history: [] });
      return;
    }
    const businessDate = getTodayBusinessDate();
    const record = attendanceService.getAttendance(employeeId, assignmentId, businessDate);
    const history = attendanceService.getAttendanceHistory(employeeId);
    set({ todayAttendance: record, history });

    // Asynchronously sync pending offline records or refresh from server
    if (record && (record.isOfflineCaptured || record.status === 'PENDING_SYNC')) {
      attendanceService.syncPendingAttendance(employeeId, assignmentId, businessDate).then((synced) => {
        if (synced) {
          const updatedHistory = attendanceService.getAttendanceHistory(employeeId);
          set({ todayAttendance: synced, history: updatedHistory });
        }
      });
    } else if (!record) {
      attendanceService.fetchServerAttendance(employeeId, assignmentId, businessDate).then((serverRec) => {
        if (serverRec) {
          const updatedHistory = attendanceService.getAttendanceHistory(employeeId);
          set({ todayAttendance: serverRec, history: updatedHistory });
        }
      });
    }
  },

  markAttendance: async (params: MarkAttendanceParams) => {
    const record = await attendanceService.markAttendance(params);
    const history = attendanceService.getAttendanceHistory(params.employeeId);
    set({ todayAttendance: record, history });
    return record;
  },

  markCheckOut: async (params: MarkCheckOutParams) => {
    const record = await attendanceService.markCheckOut(params);
    if (record) {
      const history = attendanceService.getAttendanceHistory(params.employeeId);
      set({ todayAttendance: record, history });
    }
    return record;
  },

  resetState: () => {
    set({ todayAttendance: null, history: [], isLoading: false });
  },
}));


