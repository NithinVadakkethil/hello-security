export interface AttendanceFilterQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: string;
  siteId?: string;
  employeeId?: string;
  status?: string; // 'ALL' | 'PRESENT' | 'LATE' | 'OFF' | 'COMPLETED'
  date?: string; // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  datePreset?: string; // 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AttendanceRecordDto {
  id: string;
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeNumber: string;
  employeePhoto?: string | null;
  employeeEmail?: string | null;
  employeePhone?: string | null;
  employeeDesignation?: string | null;
  siteId: string;
  siteName: string;
  siteAddress?: string | null;
  shiftId: string;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  shiftDate: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  employeeCode?: string;
  checkInTime: string | null;
  checkInTimeRaw: string | null;
  checkOutTime: string | null;
  checkOutTimeRaw: string | null;
  status: 'PRESENT' | 'LATE' | 'OFF' | 'COMPLETED';
  isLate: boolean;
  workingDuration: string;
  workingDurationMins: number;
  verificationMethod: string;
  verificationStatus: string;
  patrolSessionsCount: number;
  completedPatrolsCount: number;
  assignmentType: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceListResponseDto {
  records: AttendanceRecordDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  metrics: {
    totalCheckedIn: number;
    totalPresent: number;
    totalLate: number;
    totalCompleted: number;
    totalOff: number;
    totalActiveStaff: number;
  };
}
