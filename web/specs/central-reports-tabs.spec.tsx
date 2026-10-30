import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CentralReportsPage from '../src/app/central/reports/page';
import ProjectAttendanceReportsView from '../src/app/central/reports/components/ProjectAttendanceReportsView';
import CentralAttendancePage from '../src/app/central/attendance/page';
import CentralManagerLayout from '../src/app/central/layout';
import { apiClient } from '../src/app/lib/axios';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();
let mockPathname = '/central/reports';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
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

jest.mock('../src/app/components/protected-route', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/app/dashboard/components/NotificationBell', () => {
  return function MockNotificationBell() {
    return <div data-testid="notification-bell">Bell</div>;
  };
});

// Mock PeriodicReportGenerator and DetailedReportModal to keep test focused
jest.mock('../src/app/dashboard/reports/components/PeriodicReportGenerator', () => {
  return function MockPeriodicReportGenerator(props: any) {
    return <div data-testid="periodic-report-generator">Periodic Report Generator for {props.clientId}</div>;
  };
});

jest.mock('../src/app/dashboard/reports/components/DetailedReportModal', () => {
  return function MockDetailedReportModal() {
    return <div data-testid="detailed-report-modal">Detailed Report Modal</div>;
  };
});

describe('Community Manager Reports & Analytics — Consolidated Patrol and Attendance', () => {
  const mockOrganizations = [
    {
      id: 'client-1',
      companyName: 'Atlabs Demo Client',
      clientCode: 'ATL-001',
      clientLogoUrl: null,
      metrics: {
        employeesCount: 12,
        observations: { open: 0, reviewed: 0, total: 0 },
        snags: { open: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 },
        reports: { completedPatrols: 18, totalPatrols: 20 },
      },
    },
    {
      id: 'client-2',
      companyName: 'Marina 101 Tower',
      clientCode: 'M101-002',
      clientLogoUrl: null,
      metrics: {
        employeesCount: 25,
        observations: { open: 1, reviewed: 2, total: 3 },
        snags: { open: 2, inProgress: 1, resolved: 0, closed: 0, total: 3 },
        reports: { completedPatrols: 45, totalPatrols: 50 },
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockPathname = '/central/reports';
  });

  describe('TASK 1 — Sidebar Navigation Update', () => {
    it('removes the Attendance menu item while preserving Dashboard, Employees, Reports, and Profile', () => {
      mockPathname = '/central/reports';
      render(
        <CentralManagerLayout>
          <div>Content</div>
        </CentralManagerLayout>
      );

      // Verify Attendance is NOT in the sidebar
      expect(screen.queryByRole('link', { name: /^attendance$/i })).toBeNull();

      // Verify remaining items are present
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeTruthy();
      expect(screen.getByRole('link', { name: /employees/i })).toBeTruthy();
      expect(screen.getByRole('link', { name: /reports & analytics/i })).toBeTruthy();
      expect(screen.getByRole('link', { name: /my profile/i })).toBeTruthy();
    });
  });

  describe('TASK 2 — Preserve All Projects Reporting Page', () => {
    it('displays the project-selection page when no clientId is present in URL', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockOrganizations,
      });

      render(<CentralReportsPage />);

      expect(screen.getByText('Reports & Analytics')).toBeTruthy();
      expect(
        screen.getByText(
          'Select an assigned project to view operational patrol reports, checkpoint compliance, and inspection audits.'
        )
      ).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByText('Atlabs Demo Client')).toBeTruthy();
        expect(screen.getByText('Marina 101 Tower')).toBeTruthy();
      });

      // Clicking a project card navigates to the selected project report page with default patrol tab
      const selectCard = screen.getByRole('button', { name: /atlabs demo client/i });
      fireEvent.click(selectCard);

      expect(mockPush).toHaveBeenCalledWith('/central/reports?clientId=client-1');
    });

    it('preserves tab=attendance when navigating from project-selection page if tab query was set', async () => {
      mockSearchParams = new URLSearchParams({ tab: 'attendance' });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockOrganizations,
      });

      render(<CentralReportsPage />);

      await waitFor(() => {
        expect(screen.getByText('Atlabs Demo Client')).toBeTruthy();
      });

      const selectCard = screen.getByRole('button', { name: /atlabs demo client/i });
      fireEvent.click(selectCard);

      expect(mockPush).toHaveBeenCalledWith('/central/reports?clientId=client-1&tab=attendance');
    });
  });

  describe('TASK 3 & 4 — Top-Level Report Tabs and Patrol Reports Tab', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams({ clientId: 'client-1' });
    });

    it('renders top-level tabs: Patrol Reports and Attendance Reports with accessible semantics', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/central-manager/organizations')) {
          return Promise.resolve({ data: mockOrganizations });
        }
        if (url.includes('/sites')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/central-manager/reports')) {
          return Promise.resolve({ data: [], meta: { totalCount: 0, totalPages: 1 } });
        }
        return Promise.resolve({ data: [] });
      });

      render(<CentralReportsPage />);

      const tablist = screen.getByRole('tablist', { name: /report category/i });
      expect(tablist).toBeTruthy();

      const patrolTab = screen.getByRole('tab', { name: /patrol reports/i });
      const attendanceTab = screen.getByRole('tab', { name: /attendance reports/i });

      expect(patrolTab).toBeTruthy();
      expect(attendanceTab).toBeTruthy();

      // Patrol reports is default active tab
      expect(patrolTab.getAttribute('aria-selected')).toBe('true');
      expect(attendanceTab.getAttribute('aria-selected')).toBe('false');

      // Periodic report generator is rendered
      expect(screen.getByTestId('periodic-report-generator')).toBeTruthy();
    });

    it('switches to Attendance Reports tab when clicked and updates URL', async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/central-manager/organizations')) {
          return Promise.resolve({ data: mockOrganizations });
        }
        if (url.includes('/sites')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/central-manager/reports')) {
          return Promise.resolve({ data: [], meta: { totalCount: 0, totalPages: 1 } });
        }
        if (url.includes('/central-manager/employees')) {
          return Promise.resolve({ data: { employees: [] } });
        }
        if (url.includes('/attendance')) {
          return Promise.resolve({ data: { records: [], total: 0, totalPages: 1 } });
        }
        return Promise.resolve({ data: [] });
      });

      render(<CentralReportsPage />);

      const attendanceTab = screen.getByRole('tab', { name: /attendance reports/i });
      fireEvent.click(attendanceTab);

      expect(mockPush).toHaveBeenCalledWith('/central/reports?clientId=client-1&tab=attendance');
    });

    it('supports keyboard navigation (ArrowRight and ArrowLeft) between tabs', async () => {
      (apiClient.get as jest.Mock).mockImplementation(() => Promise.resolve({ data: [] }));

      render(<CentralReportsPage />);

      const patrolTab = screen.getByRole('tab', { name: /patrol reports/i });
      fireEvent.keyDown(patrolTab, { key: 'ArrowRight' });

      expect(mockPush).toHaveBeenCalledWith('/central/reports?clientId=client-1&tab=attendance');
    });
  });

  describe('TASK 5 & 7 — Attendance Reports View and State Preservation', () => {
    it('fetches and displays attendance summary metrics and data records for selected client', async () => {
      const mockAttendanceRecords = [
        {
          id: 'att-1',
          employeeId: 'emp-1',
          employeeName: 'Asif Khan',
          employeeRole: 'TECHNICIAN',
          employeeCode: 'EMP-000012',
          siteId: 'site-1',
          siteName: 'Main Tower',
          shiftName: 'Morning Shift',
          shiftStartTime: '08:00',
          shiftEndTime: '16:00',
          date: '2026-10-30',
          checkInTime: '2026-10-30 08:05 AM',
          checkOutTime: '2026-10-30 04:10 PM',
          status: 'PRESENT',
          workingDuration: '8h 5m',
          verificationMethod: 'FACE_VERIFICATION',
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/central-manager/employees')) {
          return Promise.resolve({
            data: {
              employees: [
                {
                  id: 'emp-1',
                  firstName: 'Asif',
                  lastName: 'Khan',
                  role: 'TECHNICIAN',
                  employeeNumber: 'EMP-000012',
                },
              ],
            },
          });
        }
        if (url.includes('/central-manager/sites')) {
          return Promise.resolve({
            data: { sites: [{ id: 'site-1', name: 'Main Tower' }] },
          });
        }
        if (url.includes('/attendance')) {
          return Promise.resolve({
            data: {
              records: mockAttendanceRecords,
              total: 1,
              totalPages: 1,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ProjectAttendanceReportsView clientId="client-1" />);

      await waitFor(() => {
        expect(screen.getByText('Attendance Filters')).toBeTruthy();
        expect(screen.getByText('Asif Khan')).toBeTruthy();
        expect(screen.getByText('Technician')).toBeTruthy();
        expect(screen.getAllByText('Main Tower').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Morning Shift')).toBeTruthy();
        expect(screen.getByText('2026-10-30 08:05 AM')).toBeTruthy();
        expect(screen.getByText('8h 5m')).toBeTruthy();
      });

      // Summary Metric Cards
      expect(screen.getByText('Total Records')).toBeTruthy();
      expect(screen.getByText('Total Check In Count')).toBeTruthy();
      expect(screen.getByText('Late Check-ins')).toBeTruthy();
      expect(screen.getAllByText('Shift Completed').length).toBeGreaterThanOrEqual(1);

      // Export Buttons
      expect(screen.getByRole('button', { name: /download pdf/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /download excel/i })).toBeTruthy();

      // Opens detail modal
      const detailsBtn = screen.getByRole('button', { name: /details/i });
      fireEvent.click(detailsBtn);

      await waitFor(() => {
        expect(screen.getByText('Attendance Record Details')).toBeTruthy();
        expect(screen.getByText('Verification & Metadata')).toBeTruthy();
      });
    });
  });

  describe('TASK 6 — Old Attendance Links Redirection', () => {
    it('redirects /central/attendance without clientId to /central/reports?tab=attendance', () => {
      mockSearchParams = new URLSearchParams();
      render(<CentralAttendancePage />);

      expect(mockReplace).toHaveBeenCalledWith('/central/reports?tab=attendance');
    });

    it('redirects /central/attendance?clientId=client-1 to /central/reports?clientId=client-1&tab=attendance', () => {
      mockSearchParams = new URLSearchParams({ clientId: 'client-1' });
      render(<CentralAttendancePage />);

      expect(mockReplace).toHaveBeenCalledWith(
        '/central/reports?clientId=client-1&tab=attendance'
      );
    });
  });
});
