import { create } from 'zustand';
import { AttendanceRecord, MarkAttendanceParams, MarkCheckOutParams } from '../types';
import { attendanceService, getTodayBusinessDate } from '../services/attendance-service';

interface AttendanceState {
  todayAttendance: AttendanceRecord | null;
  history: AttendanceRecord[];
  isLoading: boolean;
  loadAttendance: (employeeId: string, assignmentId: string) => void;
  markAttendance: (params: MarkAttendanceParams) => AttendanceRecord;
  markCheckOut: (params: MarkCheckOutParams) => AttendanceRecord | null;
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
  },

  markAttendance: (params: MarkAttendanceParams) => {
    const record = attendanceService.markAttendance(params);
    const history = attendanceService.getAttendanceHistory(params.employeeId);
    set({ todayAttendance: record, history });
    return record;
  },

  markCheckOut: (params: MarkCheckOutParams) => {
    const record = attendanceService.markCheckOut(params);
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

