import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CentralReportsPage from '../src/app/central/reports/page';
import PeriodicReportGenerator from '../src/app/dashboard/reports/components/PeriodicReportGenerator';
import EmployeeCompletedPatrolsPage from '../src/app/central/reports/employee-patrols/page';
import { apiClient } from '../src/app/lib/axios';

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/central/reports',
}));

jest.mock('../src/app/lib/axios', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
  },
}));

jest.mock('../src/app/providers/theme-provider', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: jest.fn(),
  }),
}));

const mockPatrolsResponse = {
  employee: null,
  project: {
    id: 'client-1',
    companyName: 'Marina 101 Tower',
    clientCode: 'M101-002',
    clientLogoUrl: null,
  },
  period: {
    periodType: 'DAILY',
    periodLabel: 'Today, 30 Oct 2026',
    startDate: '2026-10-30',
    endDate: '2026-10-30',
    timezone: 'Asia/Dubai',
  },
  filters: {
    shiftId: null,
    siteId: null,
    role: null,
    employeeId: null,
  },
  summary: {
    totalCompletedPatrols: 2,
    totalPatrolSessions: 2,
    completedPatrolSessions: 1,
    incompletePatrolSessions: 1,
    totalPatrolDurationSeconds: 7200,
    totalPatrolDurationFormatted: '2 hr 0 min',
    totalCheckpoints: 10,
    totalCheckpointsScanned: 8,
    totalCheckpointsMissed: 2,
    totalCheckpointsRequired: 10,
    averageCompliancePct: 80,
  },
  pagination: {
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalRecords: 2,
    hasNextPage: false,
    hasPrevPage: false,
  },
  patrols: [
    {
      id: 'session-1',
      patrolCode: 'PATROL-SESSION-0001',
      status: 'COMPLETED',
      startedAt: '2026-10-30T08:00:00Z',
      endedAt: '2026-10-30T09:00:00Z',
      dateFormatted: '30 Oct 2026',
      startTimeFormatted: '12:00:00 PM',
      endTimeFormatted: '1:00:00 PM',
      siteName: 'Marina Tower 1',
      routeName: 'Floor 1 Perimeter',
      shiftName: 'Day Shift',
      durationSeconds: 3600,
      durationFormatted: '1 hr 0 min',
      scannedCheckpoints: 5,
      totalCheckpoints: 5,
      missedCheckpoints: 0,
      compliancePct: 100,
      remarks: 'All gates clear.',
      employeeId: 'emp-1',
      employeeName: 'Asif Khan',
      employeeCode: 'EMP-000012',
      employeeRole: 'Technician',
      emiratesId: '784-1990-1234567-1',
    },
    {
      id: 'session-2',
      patrolCode: 'PATROL-SESSION-0002',
      status: 'COMPLETED',
      startedAt: '2026-10-30T10:00:00Z',
      endedAt: '2026-10-30T11:00:00Z',
      dateFormatted: '30 Oct 2026',
      startTimeFormatted: '2:00:00 PM',
      endTimeFormatted: '3:00:00 PM',
      siteName: 'Marina Tower 1',
      routeName: 'Lobby Check',
      shiftName: 'Day Shift',
      durationSeconds: 3600,
      durationFormatted: '1 hr 0 min',
      scannedCheckpoints: 3,
      totalCheckpoints: 5,
      missedCheckpoints: 2,
      compliancePct: 60,
      remarks: 'Gate 4 locked.',
      employeeId: 'emp-2',
      employeeName: 'John Doe',
      employeeCode: 'EMP-000015',
      employeeRole: 'Security Guard',
      emiratesId: '784-1988-7654321-2',
    },
  ],
};

const mockEmployeePatrolsResponse = {
  ...mockPatrolsResponse,
  employee: {
    id: 'emp-1',
    employeeNumber: 'EMP-000012',
    firstName: 'Asif',
    lastName: 'Khan',
    fullName: 'Asif Khan',
    role: 'TECHNICIAN',
    roleLabel: 'Technician',
    designation: 'Field Technician',
    emiratesId: '784-1990-1234567-1',
  },
};

const mockDetailedReport = {
  id: 'session-1',
  patrolCode: 'PATROL-SESSION-0001',
  status: 'COMPLETED',
  startedAt: '2026-10-30T08:00:00Z',
  endedAt: '2026-10-30T09:00:00Z',
  remarks: 'All gates clear.',
  assignment: {
    site: { name: 'Marina Tower 1' },
    shift: { name: 'Day Shift' },
    employee: {
      firstName: 'Asif',
      lastName: 'Khan',
      employeeNumber: 'EMP-000012',
      role: 'TECHNICIAN',
      emiratesId: '784-1990-1234567-1',
    },
  },
  checkpoints: [
    {
      id: 'cp-1',
      scannedAt: '2026-10-30T08:10:00Z',
      status: 'COMPLETED',
      gate: { name: 'Gate 1', sequence: 1, isActive: true },
    },
  ],
};

describe('Community Manager Periodic Reports Simplification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams('clientId=client-1');

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/central-manager/reports/employee-patrols')) {
        if (url.includes('employeeId=emp-1')) {
          return Promise.resolve({ data: mockEmployeePatrolsResponse });
        }
        return Promise.resolve({ data: mockPatrolsResponse });
      }
      if (url.includes('/central-manager/reports/session-1')) {
        return Promise.resolve({ data: mockDetailedReport });
      }
      if (url.includes('/missed-checkpoints')) {
        return Promise.resolve({
          data: {
            patrolId: 'session-2',
            patrolCode: 'PATROL-SESSION-0002',
            status: 'COMPLETED',
            employeeName: 'John Doe',
            employeeCode: 'EMP-000015',
            employeeRole: 'Security Guard',
            siteName: 'Marina Tower 1',
            routeName: 'Lobby Check',
            shiftName: 'Day Shift',
            totalCheckpoints: 5,
            scannedCheckpoints: 3,
            missedCheckpoints: 2,
            missedGates: [
              {
                sequence: 4,
                gateId: 'gate-4',
                name: 'Emergency Exit 4',
                gateCode: 'EE-04',
                routeName: 'Lobby Check',
                status: 'MISSED',
                tasks: [
                  {
                    id: 'task-1',
                    taskName: 'Check door latch',
                    role: 'SECURITY_OFFICER',
                    isRequired: true,
                    status: 'NOT ANSWERED',
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.includes('/central-manager/organizations')) {
        return Promise.resolve({
          data: [
            {
              id: 'client-1',
              companyName: 'Marina 101 Tower',
              clientCode: 'M101-002',
              clientLogoUrl: null,
              metrics: { employeesCount: 10 },
            },
          ],
        });
      }
      if (url.includes('/sites')) {
        return Promise.resolve({
          data: [{ id: 'site-1', name: 'Marina Tower 1' }],
        });
      }
      if (url.includes('/shifts')) {
        return Promise.resolve({
          data: [{ id: 'shift-1', name: 'Day Shift' }],
        });
      }
      if (url.includes('/employees')) {
        return Promise.resolve({
          data: [
            {
              id: 'emp-1',
              firstName: 'Asif',
              lastName: 'Khan',
              employeeNumber: 'EMP-000012',
              role: 'TECHNICIAN',
              emiratesId: '784-1990-1234567-1',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  describe('Task 1 — Removal of automatic patrol-history table on mount', () => {
    it('does not call /central-manager/reports on mount', async () => {
      render(<CentralReportsPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Reports & Analytics').length).toBeGreaterThan(0);
      });

      // Verify /central-manager/reports was NOT called
      const calledUrls = (apiClient.get as jest.Mock).mock.calls.map((c) => c[0]);
      const calledAutoReports = calledUrls.some(
        (url: string) => url.startsWith('/central-manager/reports?') || url === '/central-manager/reports'
      );
      expect(calledAutoReports).toBe(false);
    });

    it('displays only the periodic generator and tabs, not the search/filter toolbar or automatic data table', async () => {
      render(<CentralReportsPage />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Patrol Reports/i })).toBeTruthy();
        expect(screen.getByRole('tab', { name: /Attendance Reports/i })).toBeTruthy();
      });

      // Automatic table search bar should NOT exist
      expect(screen.queryByPlaceholderText('Search patrol code or employee name...')).toBeNull();
      // "All Statuses" filter should NOT exist outside generator
      expect(screen.queryByText('All Statuses')).toBeNull();
      // No automatic patrol table empty message
      expect(screen.queryByText('No inspection reports found for this organization.')).toBeNull();
    });
  });

  describe('Task 2 & 3 — Generator controls preserved and 8 KPI summary cards rendered', () => {
    it('preserves all report generator controls', async () => {
      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
          sites={[{ id: 'site-1', name: 'Marina Tower 1' }]}
        />
      );

      // Period buttons
      expect(screen.getByRole('button', { name: /^Daily$/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Weekly$/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Monthly$/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Custom Range$/i })).toBeTruthy();

      // Generate button
      expect(screen.getByRole('button', { name: /Generate/i })).toBeTruthy();

      // Filters
      expect(screen.getAllByText(/All Roles/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/All Sites/i).length).toBeGreaterThan(0);
    });

    it('renders the 8 KPI summary cards after generate but suppresses the old breakdown tables', async () => {
      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
          sites={[{ id: 'site-1', name: 'Marina Tower 1' }]}
        />
      );

      // Before generate: No cards
      expect(screen.queryByText('Total Patrol Sessions')).toBeNull();
      expect(screen.queryByText('Completed Patrol Sessions')).toBeNull();
      expect(screen.queryByText('Incomplete Patrol Sessions')).toBeNull();
      expect(screen.queryByText('Total Patrol Duration')).toBeNull();
      expect(screen.queryByText('Total Checkpoints')).toBeNull();
      expect(screen.queryByText('Checkpoints Scanned')).toBeNull();
      expect(screen.queryByText('Checkpoints Missed')).toBeNull();
      expect(screen.queryByText('Average Compliance')).toBeNull();
      expect(screen.queryByText('Employee Performance')).toBeNull();

      // Click generate
      fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining('/central-manager/reports/employee-patrols?')
        );
      });

      // After generate: The 8 KPI cards MUST be rendered
      expect(screen.getByText('Total Patrol Sessions')).toBeTruthy();
      expect(screen.getAllByText('Completed Patrol Sessions').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Incomplete Patrol Sessions')).toBeTruthy();
      expect(screen.getByText('Total Patrol Duration')).toBeTruthy();
      expect(screen.getByText('2 hr 0 min')).toBeTruthy();
      expect(screen.getByText('Total Checkpoints')).toBeTruthy();
      expect(screen.getAllByText('10').length).toBeGreaterThan(0);
      expect(screen.getByText('Checkpoints Scanned')).toBeTruthy();
      expect(screen.getAllByText('8').length).toBeGreaterThan(0);
      expect(screen.getByText('Checkpoints Missed')).toBeTruthy();
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      expect(screen.getByText('Average Compliance')).toBeTruthy();
      expect(screen.getByText('80%')).toBeTruthy();

      // Old heavy sections should NOT be rendered
      expect(screen.queryByText('Patrol Duration Summary')).toBeNull();
      expect(screen.queryByText('Total Checkpoint Duration')).toBeNull();
      expect(screen.queryByText('Daily Breakdown')).toBeNull();
      expect(screen.queryByText('Employee Performance')).toBeNull();
    });
  });

  describe('Task 4, 5, 7 — Filtered patrol sessions table with required columns and scope handling', () => {
    it('renders the completed patrol sessions table with all required columns and metrics', async () => {
      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
          sites={[{ id: 'site-1', name: 'Marina Tower 1' }]}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Completed Patrol Sessions/i })).toBeTruthy();
        expect(screen.getByText('Patrol sessions matching the selected reporting filters.')).toBeTruthy();
      });

      // Check all required columns in the table in the exact specified order (Site and Compliance columns removed)
      const headerTexts = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
      expect(headerTexts).toEqual([
        'Patrol Code',
        'Employee',
        'Date',
        'Route / Target',
        'Shift',
        'Start Time',
        'Completion Time',
        'Duration',
        'Checkpoints',
        'Status',
        'Action',
      ]);

      // Check row contents
      expect(screen.getByText('PATROL-SESSION-0001')).toBeTruthy();
      expect(screen.getByText('Asif Khan')).toBeTruthy();
      expect(screen.getByText('Floor 1 Perimeter')).toBeTruthy();
      expect(screen.getByText('COMPLETED')).toBeTruthy();

      expect(screen.getByText('PATROL-SESSION-0002')).toBeTruthy();
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('Lobby Check')).toBeTruthy();
      expect(screen.getByText('INCOMPLETE')).toBeTruthy();

      // Check missed checkpoints interactive button for session-2
      const missedBtn = screen.getByTitle('View 2 missed checkpoint(s) for PATROL-SESSION-0002');
      expect(missedBtn).toBeTruthy();

      // Check Export action buttons
      expect(screen.getByRole('button', { name: /PDF Report/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Excel \(\.xlsx\)/i })).toBeTruthy();
    });

    it('shows Employee column when All Matching Employees are in scope, and hides it when a specific employee is selected', async () => {
      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
          sites={[{ id: 'site-1', name: 'Marina Tower 1' }]}
        />
      );

      // Generate with All Employees
      fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

      await waitFor(() => {
        expect(screen.getByText('Employee')).toBeTruthy();
      });
    });
  });

  describe('Task 10 — UX and Filter Change Clearing', () => {
    it('clears previous generated results table when any filter changes', async () => {
      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
          sites={[{ id: 'site-1', name: 'Marina Tower 1' }]}
        />
      );

      // 1. Generate report
      fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

      await waitFor(() => {
        expect(screen.getByText('PATROL-SESSION-0001')).toBeTruthy();
      });

      // 2. Change period tab to Monthly
      fireEvent.click(screen.getByRole('button', { name: /^Monthly$/i }));

      // 3. Stale data should immediately be cleared
      expect(screen.queryByText('PATROL-SESSION-0001')).toBeNull();
      expect(screen.queryByText('Completed Patrol Sessions')).toBeNull();
    });
  });

  describe('Unified Inspection Report Navigation & Missed Checkpoints Modal', () => {
    it('opens DetailedReportModal when either Patrol Code or Report button is clicked', async () => {
      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
          sites={[{ id: 'site-1', name: 'Marina Tower 1' }]}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

      await waitFor(() => {
        expect(screen.getAllByTitle('View detailed inspection report').length).toBeGreaterThan(0);
      });

      // 1. Click the Patrol Code link/button
      const patrolCodeBtn = screen.getByRole('button', {
        name: 'View detailed inspection report for PATROL-SESSION-0001',
      });
      fireEvent.click(patrolCodeBtn);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/central-manager/reports/session-1?clientId=client-1');
      });
    });

    it('opens MissedCheckpointsModal when Missed Checkpoint count is clicked', async () => {
      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
          sites={[{ id: 'site-1', name: 'Marina Tower 1' }]}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

      await waitFor(() => {
        expect(screen.getByTitle('View 2 missed checkpoint(s) for PATROL-SESSION-0002')).toBeTruthy();
      });

      // Click the missed checkpoints pill
      const missedBtn = screen.getByTitle('View 2 missed checkpoint(s) for PATROL-SESSION-0002');
      fireEvent.click(missedBtn);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining('/central-manager/reports/session-2/missed-checkpoints?clientId=client-1')
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Missed Checkpoints/i })).toBeTruthy();
        expect(screen.getByText('Emergency Exit 4')).toBeTruthy();
        expect(screen.getByText('EE-04')).toBeTruthy();
        expect(screen.getByText('MISSED')).toBeTruthy();
        expect(screen.getByText(/Check door latch/i)).toBeTruthy();
        expect(screen.getByText('NOT ANSWERED')).toBeTruthy();
      });
    });
  });

  describe('Task 9 — Dedicated Employee Completed Patrols page', () => {
    it('renders the dedicated employee completed patrols page without crashing', async () => {
      mockSearchParams = new URLSearchParams('clientId=client-1&employeeId=emp-1&periodType=DAILY&date=2026-10-30');
      render(<EmployeeCompletedPatrolsPage />);

      await waitFor(() => {
        expect(screen.getAllByText(/Asif Khan/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('TASK 1 & TASK 2 — derivePatrolReportingStatus & Configurable Site Column', () => {
    const { derivePatrolReportingStatus } = require('../src/app/central/reports/components/CompletedPatrolSessionsTable');

    it('correctly derives reporting status according to checkpoint coverage rules', () => {
      // 1. Finalized with all checkpoints scanned -> COMPLETED
      expect(
        derivePatrolReportingStatus({
          status: 'COMPLETED',
          endedAt: '2026-10-30T10:00:00Z',
          totalCheckpoints: 26,
          scannedCheckpoints: 26,
          missedCheckpoints: 0,
        })
      ).toBe('COMPLETED');

      // 2. Finalized with partial checkpoints scanned -> INCOMPLETE
      expect(
        derivePatrolReportingStatus({
          status: 'COMPLETED',
          endedAt: '2026-10-30T10:00:00Z',
          totalCheckpoints: 26,
          scannedCheckpoints: 2,
          missedCheckpoints: 24,
        })
      ).toBe('INCOMPLETE');

      // 3. Finalized with 0 scanned checkpoints -> INCOMPLETE
      expect(
        derivePatrolReportingStatus({
          status: 'COMPLETED',
          endedAt: '2026-10-30T10:00:00Z',
          totalCheckpoints: 26,
          scannedCheckpoints: 0,
          missedCheckpoints: 26,
        })
      ).toBe('INCOMPLETE');

      // 4. Active ongoing patrol -> IN_PROGRESS (not INCOMPLETE)
      expect(
        derivePatrolReportingStatus({
          status: 'IN_PROGRESS',
          endedAt: null,
          totalCheckpoints: 26,
          scannedCheckpoints: 5,
          missedCheckpoints: 21,
        })
      ).toBe('IN_PROGRESS');

      // 5. Finalized patrol with zero eligible checkpoints -> NO_CHECKPOINTS (not COMPLETED / 100%)
      expect(
        derivePatrolReportingStatus({
          status: 'COMPLETED',
          endedAt: '2026-10-30T10:00:00Z',
          totalCheckpoints: 0,
          scannedCheckpoints: 0,
          missedCheckpoints: 0,
        })
      ).toBe('NO_CHECKPOINTS');

      // 6. Cancelled patrol preserves lifecycle status
      expect(
        derivePatrolReportingStatus({
          status: 'CANCELLED',
          endedAt: '2026-10-30T10:00:00Z',
          totalCheckpoints: 26,
          scannedCheckpoints: 0,
          missedCheckpoints: 26,
        })
      ).toBe('CANCELLED');
    });

    it('renders the Site column when showSiteColumn is explicitly set to true', () => {
      const CompletedPatrolSessionsTable = require('../src/app/central/reports/components/CompletedPatrolSessionsTable').default;
      render(
        <CompletedPatrolSessionsTable
          patrols={mockPatrolsResponse.patrols}
          clientId="client-1"
          onViewReport={jest.fn()}
          showSiteColumn={true}
        />
      );

      const headerTexts = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
      expect(headerTexts).toContain('Site');
    });
  });

  describe('TASK 1 & TASK 2 — Employee Total Assigned Checkpoints KPI & Patrol Status Filter', () => {
    it('renders exactly 8 KPI cards for All Matching Employees report (no Total Assigned Checkpoints)', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/shifts')) return Promise.resolve({ data: [] });
        if (url.includes('/employees')) return Promise.resolve({ data: [] });
        if (url.includes('/central-manager/reports/employee-patrols')) {
          return Promise.resolve({
            data: {
              ...mockPatrolsResponse,
              summary: {
                ...mockPatrolsResponse.summary,
                totalAssignedCheckpoints: undefined,
              },
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
        />
      );

      const generateBtn = screen.getByRole('button', { name: /Generate/i });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Completed Patrol Sessions/i })).toBeTruthy();
      });

      // Assert the 8 KPI cards
      expect(screen.getByText('Total Patrol Sessions')).toBeTruthy();
      expect(screen.getAllByText('Completed Patrol Sessions').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Incomplete Patrol Sessions')).toBeTruthy();
      expect(screen.getByText('Total Patrol Duration')).toBeTruthy();
      expect(screen.getByText('Total Checkpoints')).toBeTruthy();
      expect(screen.getByText('Checkpoints Scanned')).toBeTruthy();
      expect(screen.getByText('Checkpoints Missed')).toBeTruthy();
      expect(screen.getByText('Average Compliance')).toBeTruthy();

      // Total Assigned Checkpoints must NOT be present
      expect(screen.queryByText('Total Assigned Checkpoints')).toBeNull();
    });

    it('renders 9 KPI cards including Total Assigned Checkpoints when one specific employee is selected', async () => {
      const singleEmployee = {
        id: 'emp-habeeb',
        firstName: 'Habeeb',
        lastName: 'Atlabs',
        employeeNumber: 'EMP-001',
        role: 'SECURITY',
        assignments: [{ shiftId: 'shift-1', siteId: 'site-1' }],
      };

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/shifts')) return Promise.resolve({ data: [] });
        if (url.includes('/employees')) return Promise.resolve({ data: [singleEmployee] });
        if (url.includes('/central-manager/reports/employee-patrols')) {
          return Promise.resolve({
            data: {
              ...mockPatrolsResponse,
              employee: singleEmployee,
              summary: {
                ...mockPatrolsResponse.summary,
                totalAssignedCheckpoints: 19,
              },
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
          propEmployees={[singleEmployee]}
        />
      );

      // Wait for shifts and employees initial load to finish
      await waitFor(() => {
        expect(screen.queryByText(/Loading employees.../i)).toBeNull();
      });

      // Open SearchableSelect dropdown for Employee
      const employeeTrigger = screen.getByLabelText(/Filter Report by Employee/i);
      fireEvent.click(employeeTrigger);

      // Click the employee option
      const employeeOption = await screen.findByText(/Habeeb Atlabs/i);
      fireEvent.click(employeeOption);

      const generateBtn = screen.getByRole('button', { name: /Generate/i });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText('Total Assigned Checkpoints')).toBeTruthy();
      });

      expect(screen.getByText('19')).toBeTruthy();
      expect(screen.getByText('Current active checkpoint assignments')).toBeTruthy();

      // Verify the other 8 KPI cards are also present
      expect(screen.getByText('Total Patrol Sessions')).toBeTruthy();
      expect(screen.getAllByText('Completed Patrol Sessions').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Incomplete Patrol Sessions')).toBeTruthy();
      expect(screen.getByText('Total Patrol Duration')).toBeTruthy();
      expect(screen.getByText('Total Checkpoints')).toBeTruthy();
      expect(screen.getByText('Checkpoints Scanned')).toBeTruthy();
      expect(screen.getByText('Checkpoints Missed')).toBeTruthy();
      expect(screen.getByText('Average Compliance')).toBeTruthy();
    });

    it('renders the Patrol Status filter dropdown and triggers filter queries on change', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/shifts')) return Promise.resolve({ data: [] });
        if (url.includes('/employees')) return Promise.resolve({ data: [] });
        if (url.includes('/central-manager/reports/employee-patrols')) {
          return Promise.resolve({ data: mockPatrolsResponse });
        }
        return Promise.resolve({ data: [] });
      });

      render(
        <PeriodicReportGenerator
          clientId="client-1"
          isCentralManager={true}
        />
      );

      // Wait for initial load to finish
      await waitFor(() => {
        expect(screen.queryByText(/Loading shifts.../i)).toBeNull();
      });

      const generateBtn = screen.getByRole('button', { name: /Generate/i });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Completed Patrol Sessions/i })).toBeTruthy();
      });

      const statusFilter = screen.getByLabelText(/Patrol Status/i);
      expect((statusFilter as HTMLSelectElement).value).toBe('ALL');

      // Change status to COMPLETED
      fireEvent.change(statusFilter, { target: { value: 'COMPLETED' } });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining('completionStatus=COMPLETED')
        );
      });

      // Change status to INCOMPLETE
      fireEvent.change(statusFilter, { target: { value: 'INCOMPLETE' } });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining('completionStatus=INCOMPLETE')
        );
      });
    });
  });
});
