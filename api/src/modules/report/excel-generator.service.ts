import * as XLSX from 'xlsx';
import { ReportDataset } from './summary-report.service';

export class ExcelGeneratorService {
  /**
   * Generates a multi-tab structured .xlsx Buffer from normalized ReportDataset
   */
  generateExcel(dataset: ReportDataset): Buffer {
    const wb = XLSX.utils.book_new();
    const isKaizen =
      dataset.metadata.isKaizen ||
      dataset.metadata.includeIncidents === false ||
      dataset.metadata.clientName?.toLowerCase().includes('kaizen');

    // 1. Executive Summary Sheet
    const summarySheetData: (string | number)[][] = [
      ['HELLO ORBIT EXECUTIVE SECURITY REPORT'],
      ['Report Title', dataset.metadata.title],
      ['Period Type', dataset.metadata.periodType],
      ['Reporting Period', dataset.metadata.periodLabel],
      ['Organization / Client', dataset.metadata.clientName],
      ['Site', dataset.metadata.siteName || 'All Sites'],
      ['Shift', dataset.metadata.shiftName || 'All Shifts'],
      ['Employee Category / Role', dataset.metadata.roleLabel || 'All Roles'],
    ];

    if (dataset.metadata.employeeName) {
      summarySheetData.push(
        ['Employee Name', dataset.metadata.employeeName],
        ['Employee Role', dataset.metadata.employeeRole || 'Security Guard'],
        ['Staff ID', dataset.metadata.employeeNumber || '—']
      );
      if (dataset.metadata.emiratesId) {
        summarySheetData.push(['Emirates ID', dataset.metadata.emiratesId]);
      }
    }

    summarySheetData.push(
      ['Generated Date & Time', `${dataset.metadata.generatedAt.split('T')[0]} (${dataset.metadata.timezone})`],
      [],
      ['EXECUTIVE METRICS SUMMARY', 'VALUE'],
      ['Total Patrol Duration', dataset.summary.totalPatrolDurationFormatted || '0 sec'],
      ['Total Checkpoint Duration', dataset.summary.totalCheckpointDurationFormatted || '0 sec'],
      ['Completed Patrol Sessions', dataset.summary.completedPatrolsCount ?? dataset.summary.completedPatrols],
      ['Completed Checkpoint Inspections', dataset.summary.completedCheckpointsCount ?? dataset.summary.checkpointsScanned],
      ['Average Patrol Duration', dataset.summary.avgPatrolDurationFormatted || '0 sec'],
      ['Average Checkpoint Duration', dataset.summary.avgCheckpointDurationFormatted || '0 sec'],
      ['Total Patrol Sessions (Scheduled/Started)', dataset.summary.assignedPatrols],
      ['Total Checkpoints Required', dataset.summary.totalCheckpoints ?? dataset.summary.requiredCheckpoints],
      ['Checkpoints Scanned', dataset.summary.checkpointsScanned ?? dataset.summary.completedCheckpoints],
      ['Checkpoints Missed', dataset.summary.checkpointsMissed ?? dataset.summary.missedCheckpoints],
      ['Mandatory Patrols Completed', dataset.summary.mandatoryCompleted],
      ['Mandatory Patrols Missed', dataset.summary.mandatoryMissed],
      ['Incomplete / Ongoing Patrols', dataset.summary.incompletePatrols],
      ['Additional / Extra Patrols', dataset.summary.additionalPatrols],
      ['Mandatory Patrols Scheduled', dataset.summary.mandatoryScheduled],
      ['Total Employees', dataset.summary.totalEmployees],
      ['Active Employees', dataset.summary.activeEmployees],
    );

    if (!isKaizen) {
      summarySheetData.push(['Reported Security Incidents', dataset.summary.incidentsCount]);
    }

    summarySheetData.push(
      [],
      ['* Note: Total Patrol Duration and Total Checkpoint Duration represent cumulative durations clipped to the period.', ''],
      ['Checkpoint inspection occurs within patrol time and values must not be combined as physical working time.', '']
    );

    const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // 2. Daily Duration Breakdown Sheet
    if (dataset.dailyBreakdown && dataset.dailyBreakdown.length > 0) {
      const formattedDaily = dataset.dailyBreakdown.map((d) => ({
        'Date': d.dateFormatted || d.date,
        'Shift': d.shiftName,
        'Site': d.siteName,
        'Patrol Sessions': d.patrolSessionsCount,
        'Patrol Duration': d.patrolDurationFormatted,
      }));
      const wsDaily = XLSX.utils.json_to_sheet(formattedDaily);
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Duration Breakdown');
    }

    // 3. Attendance Sheet
    if (dataset.attendance && dataset.attendance.length > 0) {
      const formattedAttendance = dataset.attendance.map((att) => ({
        'Shift Date': att.shiftDate,
        'Employee': att.employeeName,
        'Staff ID': att.employeeNumber || '—',
        'Emirates ID': att.emiratesId || 'Not provided',
        'Role': att.employeeRole || 'Security Guard',
        'Site Name': att.siteName,
        'Shift Name': att.shiftName,
        'Check-In Time': att.checkInTime || '—',
        'Check-Out Time': att.checkOutTime || '—',
        'Attendance Status': att.status,
      }));
      const wsAttendance = XLSX.utils.json_to_sheet(formattedAttendance);
      XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance');
    }

    // 4. Mandatory Patrol Compliance Sheet
    if (dataset.mandatoryPatrols.length > 0) {
      const formattedMandatory = dataset.mandatoryPatrols.map((m) => ({
        'Patrol Sequence': `Patrol ${m.sequence}`,
        'Employee': m.guardName,
        'Staff ID': m.employeeNumber || '—',
        'Emirates ID': m.emiratesId || 'Not provided',
        'Role': m.employeeRole || 'Security Guard',
        'Site Name': m.siteName,
        'Shift Name': m.shiftName,
        'Scheduled Time': m.scheduledAt,
        'Window Start': m.windowStart,
        'Window End': m.windowEnd,
        'Compliance Status': m.status,
        'Completed At': m.completedAt || '—',
      }));
      const wsMandatory = XLSX.utils.json_to_sheet(formattedMandatory);
      XLSX.utils.book_append_sheet(wb, wsMandatory, 'Mandatory Patrols');
    }

    // 5. Patrol Sessions Sheet (Employee Scoped Report Only)
    if (dataset.metadata.employeeId && dataset.patrols && dataset.patrols.length > 0) {
      const formattedPatrols = dataset.patrols.map((p) => ({
        'Patrol Code': p.patrolCode,
        'Employee': p.employeeName || p.guardName,
        'Emirates ID': p.emiratesId || dataset.metadata.emiratesId || 'Not provided',
        'Role': p.employeeRole || 'Security Guard',
        'Site / Route': `${p.siteName} - ${p.routeName}`,
        'Started At': p.startedAt,
        'Completed At': p.completedAt || '—',
        'Patrol Duration (Clipped)': p.durationFormatted || '—',
        'Full Session Duration': p.fullDurationFormatted || '—',
        'Checkpoints Completed': p.checkpointsCompleted,
        'Checkpoints Required': p.checkpointsRequired,
        'Checkpoint Duration': p.checkpointDurationFormatted || '—',
        'Status': p.status,
      }));
      const wsPatrols = XLSX.utils.json_to_sheet(formattedPatrols);
      XLSX.utils.book_append_sheet(wb, wsPatrols, 'Patrol Sessions');
    }

    // 6. Checkpoints Sheet
    if (dataset.checkpoints.length > 0) {
      const formattedCheckpoints = dataset.checkpoints.map((cp) => ({
        'Checkpoint Gate': cp.gateName,
        'Site Name': cp.siteName,
        'Employee': cp.guardName,
        'Patrol Session Code': cp.patrolCode,
        'Scanned Timestamp': cp.scannedAt,
        'Verification Status': cp.status,
        'Employee Remarks': cp.remarks || '',
      }));
      const wsCheckpoints = XLSX.utils.json_to_sheet(formattedCheckpoints);
      XLSX.utils.book_append_sheet(wb, wsCheckpoints, 'Checkpoints');
    }

    // 7. Incidents Sheet (Completely omitted for Kaizen)
    if (!isKaizen && dataset.incidents && dataset.incidents.length > 0) {
      const formattedIncidents = dataset.incidents.map((inc) => ({
        'Incident ID': inc.id,
        'Type': inc.type,
        'Severity': inc.severity,
        'Status': inc.status,
        'Site Name': inc.siteName,
        'Employee': inc.guardName,
        'Reported At': inc.reportedAt,
        'Description': inc.description,
      }));
      const wsIncidents = XLSX.utils.json_to_sheet(formattedIncidents);
      XLSX.utils.book_append_sheet(wb, wsIncidents, 'Incidents');
    }

    // 8. Site Summary Sheet
    if (dataset.siteSummary.length > 0) {
      const formattedSiteSummary = dataset.siteSummary.map((s) => ({
        'Site Name': s.siteName,
        'Completed Patrols': s.completedPatrols,
        'Mandatory Scheduled': s.mandatoryScheduled,
        'Mandatory Completed': s.mandatoryCompleted,
        'Mandatory Compliance %': `${s.mandatoryCompliancePct}%`,
        'Checkpoints Scanned': `${s.completedCheckpoints} / ${s.requiredCheckpoints}`,
      }));
      const wsSiteSummary = XLSX.utils.json_to_sheet(formattedSiteSummary);
      XLSX.utils.book_append_sheet(wb, wsSiteSummary, 'Site Summary');
    }

    // 9. Employee Summary Sheet
    if (dataset.employeeSummary.length > 0) {
      const formattedEmpSummary = dataset.employeeSummary.map((e) => ({
        'Employee': e.employeeName,
        'Staff ID': e.employeeNumber || '—',
        'Emirates ID': e.emiratesId || 'Not provided',
        'Role': e.employeeRole || 'Security Guard',
        'Site Name': e.siteName,
        'Completed Patrols': e.completedPatrols,
        'Patrol Duration': e.patrolDurationFormatted || '0 sec',
        'Mandatory Scheduled': e.mandatoryScheduled,
        'Mandatory Completed': e.mandatoryCompleted,
        'Mandatory Compliance %': `${e.mandatoryCompliancePct}%`,
      }));
      const wsEmpSummary = XLSX.utils.json_to_sheet(formattedEmpSummary);
      XLSX.utils.book_append_sheet(wb, wsEmpSummary, 'Employee Summary');
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}

export const excelGeneratorService = new ExcelGeneratorService();

