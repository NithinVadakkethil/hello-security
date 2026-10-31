import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CentralDashboardPage from '../src/app/central/dashboard/page';
import CentralProjectsPage from '../src/app/central/projects/page';
import OrganizationHeroCard, { SelectedClientData } from '../src/app/central/dashboard/components/OrganizationHeroCard';
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
  },
}));

describe('Community Manager Executive Dashboard & All Projects Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  describe('CentralProjectsPage (/central/projects)', () => {
    const mockOrganizations = [
      {
        id: 'client-1',
        companyName: 'Atlabs Demo',
        clientCode: 'ATL-001',
        clientLogoUrl: 'https://orbit.helloentry.com/logo1.png',
      },
      {
        id: 'client-2',
        companyName: 'Marina 101 Tower',
        clientCode: 'M101-002',
        clientLogoUrl: null,
      },
      {
        id: 'client-3',
        companyName: 'Kaizen Properties',
        clientCode: 'KP-003',
        clientLogoUrl: null,
      },
    ];

    it('renders heading, subtitle, search input, and project cards', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockOrganizations,
      });

      render(<CentralProjectsPage />);

      expect(screen.getByText('All Projects')).toBeTruthy();
      expect(
        screen.getByText('Select a project to view its operational dashboard.')
      ).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByText('Atlabs Demo')).toBeTruthy();
        expect(screen.getByText('Marina 101 Tower')).toBeTruthy();
        expect(screen.getByText('Kaizen Properties')).toBeTruthy();
      });

      // Verification that cards only show name and logo/initials (no employee counts or IDs)
      expect(screen.queryByText('ATL-001')).toBeNull();
      expect(screen.queryByText('M101-002')).toBeNull();
    });

    it('filters projects live by search query and allows clearing', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockOrganizations,
      });

      render(<CentralProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Atlabs Demo')).toBeTruthy();
      });

      const searchInput = screen.getByPlaceholderText('Search projects by name...');

      // Filter with lower case query
      fireEvent.change(searchInput, { target: { value: 'marina' } });
      expect(screen.getByText('Marina 101 Tower')).toBeTruthy();
      expect(screen.queryByText('Atlabs Demo')).toBeNull();
      expect(screen.queryByText('Kaizen Properties')).toBeNull();

      // Clear search button
      const clearBtn = screen.getByLabelText('Clear search');
      fireEvent.click(clearBtn);

      expect(screen.getByText('Atlabs Demo')).toBeTruthy();
      expect(screen.getByText('Marina 101 Tower')).toBeTruthy();
      expect(screen.getByText('Kaizen Properties')).toBeTruthy();
    });

    it('shows empty search state when no projects match query', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockOrganizations,
      });

      render(<CentralProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Atlabs Demo')).toBeTruthy();
      });

      const searchInput = screen.getByPlaceholderText('Search projects by name...');
      fireEvent.change(searchInput, { target: { value: 'Nonexistent Project' } });

      expect(screen.getByText('No matching projects found')).toBeTruthy();
    });

    it('navigates to /central/dashboard?clientId=... when a project card is clicked', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockOrganizations,
      });

      render(<CentralProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Atlabs Demo')).toBeTruthy();
      });

      const card = screen.getByRole('button', {
        name: /open dashboard for atlabs demo/i,
      });
      fireEvent.click(card);

      expect(mockPush).toHaveBeenCalledWith('/central/dashboard?clientId=client-1');
    });
  });

  describe('OrganizationHeroCard Total Checkpoints KPI', () => {
    const mockClientData: SelectedClientData = {
      id: 'client-1',
      companyName: 'Atlabs Demo',
      clientCode: 'ATL-001',
      clientLogoUrl: null,
      address: 'Business Bay, Dubai',
      metrics: {
        employeesCount: 15,
        completedPatrolsCount: 42,
        totalPatrolSessionsCount: 42,
        completedPatrolSessionsCount: 38,
        incompletePatrolSessionsCount: 4,
        activePatrolsCount: 2,
        totalObservationsCount: 0,
        openObservationsCount: 0,
        reviewedObservationsCount: 0,
        totalSnagsCount: 0,
        openSnagsCount: 0,
        wipSnagsCount: 0,
        closedSnagsCount: 0,
        totalCheckpoints: 28,
        totalConfiguredCheckpoints: 28,
        totalCheckpointsScanned: 250,
        totalCheckpointsMissed: 5,
        complianceRate: 98,
      },
    };

    it('renders Total Checkpoints KPI in the selected project hero card', () => {
      render(<OrganizationHeroCard client={mockClientData} />);

      expect(screen.getByText('Total Checkpoints')).toBeTruthy();
      expect(screen.getByText('28')).toBeTruthy();
      expect(screen.getByText('Checkpoints Scanned')).toBeTruthy();
      expect(screen.getByText('250')).toBeTruthy();
      expect(screen.getByText('Checkpoints Missed')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
      expect(screen.getByText('Compliance')).toBeTruthy();
      expect(screen.getByText('98%')).toBeTruthy();
    });
  });

  describe('CentralDashboardPage (/central/dashboard)', () => {
    const mockDashboardData = {
      global: {
        organizationsCount: 5,
        totalEmployees: 48,
        completedPatrols: 132,
        totalPatrolSessions: 132,
        completedPatrolSessions: 120,
        incompletePatrolSessions: 12,
        totalCheckpoints: 64,
        totalConfiguredCheckpoints: 64,
        totalCheckpointsScanned: 820,
        totalCheckpointsMissed: 18,
        avgCompliance: 97,
        openObservations: 0,
        openSnags: 0,
      },
      clients: [
        {
          id: 'client-1',
          companyName: 'Atlabs Demo',
          clientCode: 'ATL-001',
        },
      ],
      selectedClient: {
        id: 'client-1',
        companyName: 'Atlabs Demo',
        clientCode: 'ATL-001',
        metrics: {
          employeesCount: 15,
          completedPatrolsCount: 42,
          totalPatrolSessionsCount: 42,
          completedPatrolSessionsCount: 38,
          incompletePatrolSessionsCount: 4,
          activePatrolsCount: 2,
          totalObservationsCount: 0,
          openObservationsCount: 0,
          reviewedObservationsCount: 0,
          totalSnagsCount: 0,
          openSnagsCount: 0,
          wipSnagsCount: 0,
          closedSnagsCount: 0,
          totalCheckpoints: 28,
          totalConfiguredCheckpoints: 28,
          totalCheckpointsScanned: 250,
          totalCheckpointsMissed: 5,
          complianceRate: 98,
        },
      },
    };

    it('renders branded Hello Orbit LoadingState during initial load and omits generic loader', () => {
      // Mock apiClient.get to remain pending
      (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));

      render(<CentralDashboardPage />);

      // Verify branded LoadingState is present with accessible status role and label
      expect(screen.getByRole('status', { name: /loading/i })).toBeTruthy();
      expect(screen.getByText('Loading Executive Dashboard...')).toBeTruthy();
      expect(screen.getByAltText('Hello Orbit Logo')).toBeTruthy();

      // Ensure the old generic spinner and text are not present
      expect(
        screen.queryByText('Loading Community Manager Executive Dashboard...')
      ).toBeNull();
    });

    it('fetches dashboard data without any date parameters (all-time metrics)', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockDashboardData,
      });

      render(<CentralDashboardPage />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/central-manager/dashboard');
      });

      // Verify no date parameters were included
      const calledUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
      expect(calledUrl).not.toContain('dateFrom');
      expect(calledUrl).not.toContain('dateTo');
      expect(calledUrl).not.toContain('periodType');
    });

    it('renders the 9 Executive Dashboard KPIs including Total Projects and Total Checkpoints', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockDashboardData,
      });

      render(<CentralDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Executive Dashboard')).toBeTruthy();
      });

      // Verify KPI labels
      expect(screen.getByText('Total Projects')).toBeTruthy();
      expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText('Total Employees')).toBeTruthy();
      expect(screen.getByText('48')).toBeTruthy();

      expect(screen.getAllByText('Total Patrol Sessions').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('132')).toBeTruthy();

      expect(screen.getAllByText('Completed Patrol Sessions').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('120')).toBeTruthy();

      expect(screen.getAllByText('Incomplete Patrol Sessions').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('12')).toBeTruthy();

      expect(screen.getAllByText('Total Checkpoints').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('64').length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText('Times Scanned/ Checked')).toBeTruthy();
      expect(screen.getByText('820')).toBeTruthy();

      expect(screen.getByText('Missed')).toBeTruthy();
      expect(screen.getByText('18')).toBeTruthy();

      expect(screen.getByText('Average Compliance')).toBeTruthy();
      expect(screen.getAllByText('97%').length).toBeGreaterThanOrEqual(1);
    });

    it('navigates to /central/projects when clicking Total Projects KPI card', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockDashboardData,
      });

      render(<CentralDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Executive Dashboard')).toBeTruthy();
      });

      const totalProjectsBtn = screen.getByRole('button', {
        name: /view all authorized projects/i,
      });
      fireEvent.click(totalProjectsBtn);

      expect(mockPush).toHaveBeenCalledWith('/central/projects');
    });

    it('does NOT render date filters or Operational & Workforce Summary section', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockDashboardData,
      });

      render(<CentralDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Executive Dashboard')).toBeTruthy();
      });

      // Date filter controls should not be rendered
      expect(screen.queryByText('Today')).toBeNull();
      expect(screen.queryByText('Last 7 Days')).toBeNull();
      expect(screen.queryByText('This Month')).toBeNull();
      expect(screen.queryByText('Custom Range')).toBeNull();
      expect(screen.queryByLabelText(/select date range/i)).toBeNull();

      // Operational & Workforce Summary should not be rendered
      expect(screen.queryByText('Operational & Workforce Summary')).toBeNull();
      expect(screen.queryByText('Patrol & Checkpoint Performance')).toBeNull();
      expect(screen.queryByText('Workforce Roles')).toBeNull();
      expect(screen.queryByText('Audit Reports')).toBeNull();
      expect(screen.queryByText('Employees List')).toBeNull();
    });
  });
});
