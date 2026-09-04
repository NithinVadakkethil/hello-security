export interface StartPatrolDto {
  assignmentId: string;
  startedAt?: string;
}

export interface CompletePatrolDto {
  remarks?: string;
  endedAt?: string;
  completedAt?: string;
}

export interface ListPatrolSessionsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  tab?: 'live' | 'history' | string;
  filter?: 'all' | 'pending' | 'today' | 'yesterday' | 'completed' | string;
  siteId?: string;
  employeeId?: string;
}
