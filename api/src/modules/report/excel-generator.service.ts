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
    ];

    if (dataset.metadata.employeeName) {
      summarySheetData.push(
        ['Employee Name', dataset.metadata.employeeName],
        ['Employee Role', dataset.metadata.employeeRole || 'Security Guard'],
        ['Staff ID', dataset.metadata.employeeNumber || '—']
      );
    }

    summarySheetData.push(
      ['Generated Date & Time', `${dataset.metadata.generatedAt.split('T')[0]} (${dataset.metadata.timezone})`],
      [],
      ['EXECUTIVE METRICS SUMMARY', 'VALUE'],
      ['Mandatory Patrols Completed', dataset.summary.mandatoryCompleted],
      ['Mandatory Patrols Missed', dataset.summary.mandatoryMissed],
      ['Total Patrol Sessions', dataset.summary.assignedPatrols],
      ['Total Checkpoints', dataset.summary.totalCheckpoints ?? dataset.summary.requiredCheckpoints],
      ['Checkpoints Scanned', dataset.summary.checkpointsScanned ?? dataset.summary.completedCheckpoints],
      ['Checkpoints Missed', dataset.summary.checkpointsMissed ?? dataset.summary.missedCheckpoints],
      ['Completed Patrol Sessions', dataset.summary.completedPatrols],
      ['Incomplete / Ongoing Patrols', dataset.summary.incompletePatrols],
      ['Additional / Extra Patrols', dataset.summary.additionalPatrols],
      ['Mandatory Patrols Scheduled', dataset.summary.mandatoryScheduled],
      ['Total Guards / Employees', dataset.summary.totalEmployees],
      ['Active Guards', dataset.summary.activeEmployees],
    );

    if (!isKaizen) {
      summarySheetData.push(['Reported Security Incidents', dataset.summary.incidentsCount]);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // 2. Attendance Sheet
    if (dataset.attendance && dataset.attendance.length > 0) {
      const formattedAttendance = dataset.attendance.map((att) => ({
        'Shift Date': att.shiftDate,
        'Employee': att.employeeName,
        'Role': att.employeeRole || 'Security Guard',
        'Staff ID': att.employeeNumber,
        'Site Name': att.siteName,
        'Shift Name': att.shiftName,
        'Check-In Time': att.checkInTime || '—',
        'Check-Out Time': att.checkOutTime || '—',
        'Attendance Status': att.status,
      }));
      const wsAttendance = XLSX.utils.json_to_sheet(formattedAttendance);
      XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance');
    }

    // 3. Mandatory Patrol Compliance Sheet
    if (dataset.mandatoryPatrols.length > 0) {
      const formattedMandatory = dataset.mandatoryPatrols.map((m) => ({
        'Patrol Sequence': `Patrol ${m.sequence}`,
        'Employee': m.guardName,
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

    // 4. Patrol Sessions Sheet (Employee Scoped Report Only)
    if (dataset.metadata.employeeId && dataset.patrols && dataset.patrols.length > 0) {
      const formattedPatrols = dataset.patrols.map((p) => ({
        'Patrol Code': p.patrolCode,
        'Employee': p.employeeName || p.guardName,
        'Role': p.employeeRole || 'Security Guard',
        'Site / Route': `${p.siteName} - ${p.routeName}`,
        'Started At': p.startedAt,
        'Completed At': p.completedAt || '—',
        'Checkpoints Completed': p.checkpointsCompleted,
        'Checkpoints Required': p.checkpointsRequired,
        'Status': p.status,
      }));
      const wsPatrols = XLSX.utils.json_to_sheet(formattedPatrols);
      XLSX.utils.book_append_sheet(wb, wsPatrols, 'Patrol Sessions');
    }

    // 5. Checkpoints Sheet
    if (dataset.checkpoints.length > 0) {
      const formattedCheckpoints = dataset.checkpoints.map((cp) => ({
        'Checkpoint Gate': cp.gateName,
        'Site Name': cp.siteName,
        'Employee': cp.guardName,
        'Patrol Session Code': cp.patrolCode,
        'Scanned Timestamp': cp.scannedAt,
        'Verification Status': cp.status,
        'Officer Remarks': cp.remarks || '',
      }));
      const wsCheckpoints = XLSX.utils.json_to_sheet(formattedCheckpoints);
      XLSX.utils.book_append_sheet(wb, wsCheckpoints, 'Checkpoints');
    }

    // 6. Incidents Sheet (Completely omitted for Kaizen)
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

    // 7. Site Summary Sheet
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

    // 8. Employee Summary Sheet
    if (dataset.employeeSummary.length > 0) {
      const formattedEmpSummary = dataset.employeeSummary.map((e) => ({
        'Employee': e.employeeName,
        'Role': e.employeeRole || 'Security Guard',
        'Site Name': e.siteName,
        'Completed Patrols': e.completedPatrols,
        'Mandatory Scheduled': e.mandatoryScheduled,
        'Mandatory Completed': e.mandatoryCompleted,
        'Mandatory Compliance %': `${e.mandatoryCompliancePct}%`,
        'Checkpoints Scanned': e.checkpointsScanned,
      }));
      const wsEmpSummary = XLSX.utils.json_to_sheet(formattedEmpSummary);
      XLSX.utils.book_append_sheet(wb, wsEmpSummary, 'Employee Summary');
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}

export const excelGeneratorService = new ExcelGeneratorService();

