export interface CreateSnagDto {
  siteId: string;
  gateId?: string;
  patrolSessionId?: string;
  categoryId?: string;
  subCategoryId?: string;
  category: string;
  subCategory?: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  images?: string[];
  latitude?: number;
  longitude?: number;
}

export interface UpdateSnagStatusDto {
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED' | 'REJECTED';
  notes?: string;
}

export interface AddSnagCommentDto {
  comment: string;
}

export interface AssignSnagDto {
  assignedToId: string;
  dueDate?: string;
}

export interface CompleteSnagJobDto {
  notes?: string;
  images?: string[];
  subTaskResponses?: {
    gateSubTaskId: string;
    answer: 'YES' | 'NO';
    remarks?: string;
    images?: string[];
  }[];
  scannedGateCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface SnagFilterDto {
  siteId?: string;
  gateId?: string;
  patrolSessionId?: string;
  employeeId?: string;
  assignedToId?: string;
  status?: string;
  priority?: string;
  category?: string;
  subCategory?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
