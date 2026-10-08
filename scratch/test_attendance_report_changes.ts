import { attendanceReportService, AttendanceReportMetadata } from '../api/src/modules/attendance/attendance-report.service';
import { AttendanceRecordDto } from '../api/src/modules/attendance/attendance.types';
import * as XLSX from 'xlsx';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

console.log('=== TEST SUITE: ATTENDANCE REPORT PRESENTATION & KPI CHANGES ===\n');

// Mock data generator
function createMockRecord(id: string, name: string, status: 'PRESENT' | 'LATE' | 'OFF' | 'COMPLETED', checkInTime: string | null = null): AttendanceRecordDto {
  return {
    id,
    assignmentId: `asg_${id}`,
    employeeId: `emp_${id}`,
    employeeName: name,
    employeeRole: 'Security Guard',
    employeeNumber: `EMP-${id}`,
    siteId: 'site_1',
    siteName: 'Main Facility',
    shiftId: 'shift_1',
    shiftName: 'Day Shift',
    shiftStartTime: '08:00',
    shiftEndTime: '20:00',
    shiftDate: '2026-10-04',
    date: '2026-10-04',
    checkInTime: checkInTime,
    checkInTimeRaw: checkInTime ? '2026-10-04T08:00:00.000Z' : null,
    checkOutTime: status === 'COMPLETED' ? '20:00' : null,
    checkOutTimeRaw: status === 'COMPLETED' ? '2026-10-04T20:00:00.000Z' : null,
    status,
    isLate: status === 'LATE',
    workingDuration: checkInTime ? '8h' : '—',
    workingDurationMins: checkInTime ? 480 : 0,
    verificationMethod: 'FACE_VERIFICATION',
    verificationStatus: checkInTime ? 'VERIFIED' : 'PENDING',
    patrolSessionsCount: 0,
    completedPatrolsCount: 0,
    assignmentType: 'ROUTE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const metadata: AttendanceReportMetadata = {
  title: 'ATTENDANCE REPORT',
  clientName: 'Kaizen Properties',
  siteName: 'Peninsula 1',
  dateStr: '2026-10-04',
  generatedAt: '4 Oct 2026, 10:00:00 AM',
  timezone: 'Asia/Dubai',
};

// 1. Test: No Check-Ins (10 employees, 0 checked in)
console.log('--- Test 1: No Check-Ins (10 employees, 0 check-ins) ---');
const recordsNoCheckins: AttendanceRecordDto[] = Array.from({ length: 10 }, (_, i) =>
  createMockRecord(`${i + 1}`, `Guard ${i + 1}`, 'OFF', null)
);
const count1 = recordsNoCheckins.filter((r) => Boolean(r.checkInTimeRaw || (r.checkInTime && r.checkInTime !== '—'))).length;
assert(count1 === 0, `Total check-in count is 0 when all employees are OFF (got ${count1})`);

// 2. Test: 1 Check-In (Late employee who checked in)
console.log('\n--- Test 2: One Check-In (Late Check-In) ---');
const recordsOneCheckin: AttendanceRecordDto[] = [
  createMockRecord('1', 'Test Employee', 'LATE', '08:35 AM'),
  ...Array.from({ length: 9 }, (_, i) => createMockRecord(`${i + 2}`, `Guard ${i + 2}`, 'OFF', null)),
];
const count2 = recordsOneCheckin.filter((r) => Boolean(r.checkInTimeRaw || (r.checkInTime && r.checkInTime !== '—'))).length;
assert(count2 === 1, `Total check-in count is 1 for 1 late check-in + 9 OFF (got ${count2})`);

// 3. Test: Multiple Check-Ins (6 successful check-ins, 4 OFF)
console.log('\n--- Test 3: Multiple Check-Ins (6 check-ins, 4 OFF) ---');
const recordsSixCheckins: AttendanceRecordDto[] = [
  ...Array.from({ length: 4 }, (_, i) => createMockRecord(`${i + 1}`, `Present Guard ${i + 1}`, 'PRESENT', '08:00 AM')),
  createMockRecord('5', 'Late Guard', 'LATE', '08:25 AM'),
  createMockRecord('6', 'Completed Guard', 'COMPLETED', '08:00 AM'),
  ...Array.from({ length: 4 }, (_, i) => createMockRecord(`${i + 7}`, `Off Guard ${i + 7}`, 'OFF', null)),
];
const count3 = recordsSixCheckins.filter((r) => Boolean(r.checkInTimeRaw || (r.checkInTime && r.checkInTime !== '—'))).length;
assert(count3 === 6, `Total check-in count is 6 (got ${count3})`);

// 4. Test: PDF HTML Structure
console.log('\n--- Test 4: PDF HTML Structure & Absence of Verification Column ---');
// Call private buildPdfHtml by accessing through any cast
const pdfHtml = (attendanceReportService as any).buildPdfHtml(recordsOneCheckin, metadata);

assert(pdfHtml.includes('Total Check In Count'), 'PDF contains "Total Check In Count" metric label');
assert(!pdfHtml.includes('Present (Active)'), 'PDF does NOT contain old "Present (Active)" metric label');
assert(!pdfHtml.includes('<th>Verification</th>'), 'PDF does NOT contain <th>Verification</th> header');
assert(!pdfHtml.includes('✓ Face Verified'), 'PDF does NOT contain "✓ Face Verified" row text');
assert(pdfHtml.includes('<div class="metric-pill-val" style="color: #059669;">1</div>'), 'PDF shows Total Check In Count = 1');

// 5. Test: Excel Export Structure
console.log('\n--- Test 5: Excel Export Structure & Absence of Verification Column ---');
const excelBuffer = attendanceReportService.generateAttendanceExcel(recordsOneCheckin, metadata);
const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const sheetJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Find the table header row
const headerRow = sheetJson.find((row) => Array.isArray(row) && row.includes('Employee') && row.includes('Check-In'));
console.log('Excel Table Header:', headerRow);

assert(headerRow != null, 'Excel contains data table header');
assert(!headerRow.includes('Verification Method'), 'Excel header does NOT contain "Verification Method"');
assert(!headerRow.includes('Verification'), 'Excel header does NOT contain "Verification"');
assert(headerRow[headerRow.length - 1] === 'Duration', `Final column in Excel is "Duration" (got "${headerRow[headerRow.length - 1]}")`);

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
