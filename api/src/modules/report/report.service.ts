import { reportRepository } from './report.repository';
import { ReportQueryDto } from './report.types';

export class ReportService {
  async getAnalytics(clientId: string | undefined, query: ReportQueryDto) {
    return reportRepository.getAnalytics(clientId, query);
  }

  async getInspectionReports(clientId: string | undefined, query: ReportQueryDto) {
    return reportRepository.findInspectionReports(clientId, query);
  }

  async generateCsv(clientId: string | undefined, query: ReportQueryDto) {
    // Fetch matching records (up to 1000 for export)
    const result = await reportRepository.findInspectionReports(clientId, {
      ...query,
      page: 1,
      limit: 1000,
    });

    const headers = [
      'Report ID',
      'Patrol Code',
      'Inspection Date',
      'Guard Name',
      'Employee Code',
      'Site Name',
      'Route / Target',
      'Status',
      'Duration (Mins)',
      'Scanned Checkpoints',
      'Total Checkpoints',
      'Compliance %',
      'Incidents Reported',
      'Remarks',
    ];

    const rows = result.data.map((session) => {
      const guardName = `${session.assignment.employee.firstName} ${session.assignment.employee.lastName}`;
      const empCode = session.assignment.employee.employeeNumber;
      const siteName = session.assignment.site.name;
      const routeName = session.assignment.patrolRoute?.name || 'Direct Checkpoints';
      const scannedCount = session.checkpoints.length;
      const totalGates = session.assignment.patrolRoute?.routeGates?.length || session.assignment.assignmentGates?.length || 0;
      const compliance = totalGates > 0 ? Math.round((scannedCount / totalGates) * 100) : 100;
      const durationMins = session.totalDuration ? Math.round(session.totalDuration / 60) : 0;
      const incidentCount = session.incidents?.length || 0;

      return [
        session.id,
        session.patrolCode,
        new Date(session.startedAt).toLocaleString(),
        `"${guardName.replace(/"/g, '""')}"`,
        empCode,
        `"${siteName.replace(/"/g, '""')}"`,
        `"${routeName.replace(/"/g, '""')}"`,
        session.status,
        durationMins,
        scannedCount,
        totalGates,
        `${compliance}%`,
        incidentCount,
        `"${(session.remarks || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const reportService = new ReportService();
