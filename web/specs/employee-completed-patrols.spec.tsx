import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmployeeCompletedPatrolsPage from '../src/app/central/reports/employee-patrols/page';
import { apiClient } from '../src/app/lib/axios';

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams({
  clientId: 'client-1',
  employeeId: 'emp-habeeb',
  periodType: 'MONTHLY',
  month: '2026-09',
  date: '2026-09-01',
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
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
    dismiss: jest.fn(),
  },
}));

describe('EmployeeCompletedPatrolsPage Component', () => {
  const mockApiResponse = {
    employee: {
      id: 'emp-habeeb',
      employeeNumber: 'EMP-000017',
      firstName: 'Habeeb',
      lastName: 'Atlabs',
      fullName: 'Habeeb Atlabs',
      role: 'SUPERVISOR',
      roleLabel: 'Supervisor',
      designation: null,
      emiratesId: '784-****-*******-1',
    },
    project: {
      id: 'client-1',
      companyName: 'Atlabs Demo',
      clientCode: 'ATL-001',
      clientLogoUrl: null,
    },
    period: {
      periodType: 'MONTHLY',
      periodLabel: 'September 2026',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      timezone: 'Asia/Dubai',
    },
    filters: {
      shiftId: null,
      siteId: null,
      role: null,
    },
    summary: {
      totalCompletedPatrols: 7,
      totalPatrolDurationSeconds: 1617,
      totalPatrolDurationFormatted: '26 min 57 sec',
      totalCheckpointsScanned: 13,
      totalCheckpointsRequired: 13,
      averageCompliancePct: 100,
    },
    pagination: {
      page: 1,
      limit: 20,
      totalPages: 1,
      totalCount: 7,
    },
    patrols: [
      {
        id: 'patrol-1',
        patrolCode: 'PATROL-SESSION-000107',
        status: 'COMPLETED',
        startedAt: '2026-09-08T11:16:42.871Z',
        endedAt: '2026-09-08T11:18:47.201Z',
        dateFormatted: '08 Sep 2026',
        startTimeFormatted: '11:16:42 AM',
        endTimeFormatted: '11:18:47 AM',
        siteName: 'Atlabs Tower 1',
        routeName: 'Perimeter Route',
        shiftName: 'Day Shift',
        durationSeconds: 124,
        durationFormatted: '2 min 04 sec',
        scannedCheckpoints: 2,
        totalCheckpoints: 2,
        compliancePct: 100,
        remarks: null,
      },
      {
        id: 'patrol-2',
        patrolCode: 'PATROL-SESSION-000108',
        status: 'COMPLETED',
        startedAt: '2026-09-08T11:19:08.852Z',
        endedAt: '2026-09-08T11:19:47.839Z',
        dateFormatted: '08 Sep 2026',
        startTimeFormatted: '11:19:08 AM',
        endTimeFormatted: '11:19:47 AM',
        siteName: 'Atlabs Tower 1',
        routeName: 'Quick Route',
        shiftName: 'Day Shift',
        durationSeconds: 39,
        durationFormatted: '39 sec',
        scannedCheckpoints: 1,
        totalCheckpoints: 1,
        compliancePct: 100,
        remarks: null,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams({
      clientId: 'client-1',
      employeeId: 'emp-habeeb',
      periodType: 'MONTHLY',
      month: '2026-09',
      date: '2026-09-01',
    });
  });

  it('renders employee metadata, KPI cards, and matching completed patrol sessions', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockApiResponse });

    render(<EmployeeCompletedPatrolsPage />);

    // Check loading initially
    expect(screen.getByText(/loading completed patrol sessions/i)).toBeTruthy();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Habeeb Atlabs')).toBeTruthy();
    });

    // Employee & Scope Metadata checks
    expect(screen.getByText('EMP-000017')).toBeTruthy();
    expect(screen.getByText('Supervisor')).toBeTruthy();
    expect(screen.getByText('Atlabs Demo')).toBeTruthy();
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByText(/Emirates ID: 784-\*\*\*\*-\*\*\*\*\*\*\*-1/)).toBeTruthy();

    // Summary KPI Cards checks
    expect(screen.getByText('26 min 57 sec')).toBeTruthy();
    expect(screen.getByText('13 / 13')).toBeTruthy();

    // Patrol sessions table checks
    expect(screen.getByText('PATROL-SESSION-000107')).toBeTruthy();
    expect(screen.getByText('PATROL-SESSION-000108')).toBeTruthy();
    expect(screen.getByText('Perimeter Route')).toBeTruthy();
    expect(screen.getAllByText('Day Shift').length).toBe(2);
    expect(screen.getByText('2 min 04 sec')).toBeTruthy();
  });

  it('navigates back to periodic report preserving filters when "Back to Periodic Report" is clicked', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockApiResponse });

    render(<EmployeeCompletedPatrolsPage />);

    await waitFor(() => {
      expect(screen.getByText('Habeeb Atlabs')).toBeTruthy();
    });

    const backButton = screen.getByRole('button', { name: /back to periodic report/i });
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledTimes(1);
    const navUrl = mockPush.mock.calls[0][0];
    expect(navUrl).toContain('/central/reports');
    expect(navUrl).toContain('clientId=client-1');
    expect(navUrl).toContain('periodType=MONTHLY');
    expect(navUrl).toContain('month=2026-09');
    expect(navUrl).toContain('tab=employeeSummary');
  });

  it('opens detailed inspection report modal when "Report" button is clicked', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockApiResponse });

    const mockSingleReport = {
      id: 'patrol-1',
      patrolCode: 'PATROL-SESSION-000107',
      status: 'COMPLETED',
      startedAt: '2026-09-08T11:16:42.871Z',
      endedAt: '2026-09-08T11:18:47.201Z',
      totalDuration: 2,
      assignment: {
        site: { name: 'Atlabs Tower 1' },
        employee: { firstName: 'Habeeb', lastName: 'Atlabs', role: 'SUPERVISOR', employeeNumber: 'EMP-000017' },
        patrolRoute: { name: 'Perimeter Route', routeGates: [] },
      },
      checkpoints: [],
    };

    render(<EmployeeCompletedPatrolsPage />);

    await waitFor(() => {
      expect(screen.getByText('PATROL-SESSION-000107')).toBeTruthy();
    });

    // Mock the single inspection report call
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockSingleReport });

    const viewReportButtons = screen.getAllByTitle('View detailed inspection report');
    fireEvent.click(viewReportButtons[0]);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/central-manager/reports/patrol-1?clientId=client-1');
    });
  });
});
