import { z } from 'zod';

export const reportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  datePreset: z.string().optional(),
  employeeId: z.string().optional(),
  siteId: z.string().optional(),
  gateId: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 10)),
  sortBy: z.string().optional().default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ReportQueryDto = z.infer<typeof reportQuerySchema>;

export interface AnalyticsResult {
  totalInspections: number;
  completedInspections: number;
  failedInspections: number;
  pendingInspections: number;
  totalGuards: number;
  totalSites: number;
  totalCheckpoints: number;
  complianceRate: number;
  averageDurationMins: number;
  totalIssuesReported: number;
}
