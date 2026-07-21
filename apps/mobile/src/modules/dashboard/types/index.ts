export interface DashboardCounts {
  employees: number;
  sites: number;
  gates: number;
  shifts: number;
  routes: number;
  assignments: number;
  activePatrols: number;
}

export interface Site {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  designation: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface PatrolRoute {
  id: string;
  name: string;
  routeCode: string;
  isActive: boolean;
  routeGates?: any[];
}

export interface GuardAssignmentGate {
  id: string;
  assignmentId: string;
  gateId: string;
  sequence: number;
  gate: {
    id: string;
    gateCode: string;
    name: string;
    latitude?: number | null;
    longitude?: number | null;
  };
}

export interface GuardAssignment {
  id: string;
  clientId: string;
  employeeId: string;
  siteId: string;
  shiftId: string;
  assignmentType?: 'ROUTE' | 'DIRECT_CHECKPOINTS' | null;
  patrolRouteId?: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  employee: Employee;
  site: Site;
  shift: Shift;
  patrolRoute?: PatrolRoute | null;
  assignmentGates?: GuardAssignmentGate[];
}

export interface PatrolSession {
  id: string;
  clientId: string;
  assignmentId: string;
  patrolCode: string;
  status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  startedAt: string;
  endedAt: string | null;
  pauseCount: number;
  totalDuration: number | null;
  remarks: string | null;
  assignment?: GuardAssignment;
}
