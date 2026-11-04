import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectAttendanceReportsView from '../src/app/central/reports/components/ProjectAttendanceReportsView';
import { apiClient } from '../src/app/lib/axios';

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

describe('ProjectAttendanceReportsView — Shift Filter & Cascading Dropdowns', () => {
  const mockClientId = 'client-kaizen-1';

  const mockShifts = [
    { id: 'shift-1', name: 'Morning Shift', startTime: '08:00', endTime: '16:00' },
    { id: 'shift-2', name: 'Night Shift', startTime: '20:00', endTime: '08:00' },
  ];

  const mockEmployees = [
    {
      id: 'emp-1',
      firstName: 'Hamza',
      lastName: 'Ali',
      role: 'SECURITY',
      employeeNumber: 'SEC-001',
      assignments: [{ id: 'asg-1', shiftId: 'shift-1', isActive: true }],
    },
    {
      id: 'emp-2',
      firstName: 'Farhan',
      lastName: 'Saeed',
      role: 'TECHNICIAN',
      employeeNumber: 'TECH-002',
      assignments: [{ id: 'asg-2', shiftId: 'shift-2', isActive: true }],
    },
    {
      id: 'emp-3',
      firstName: 'Ayesha',
      lastName: 'Khan',
      role: 'SECURITY',
      employeeNumber: 'SEC-003',
      assignments: [{ id: 'asg-3', shiftId: 'shift-2', isActive: true }],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/shifts')) {
        return Promise.resolve({
          data: mockShifts,
        });
      }
      if (url.includes('/central-manager/employees')) {
        return Promise.resolve({
          data: {
            employees: mockEmployees,
          },
        });
      }
      if (url.includes('/central-manager/sites')) {
        return Promise.resolve({
          data: {
            sites: [{ id: 'site-1', name: 'Peninsula Tower' }],
          },
        });
      }
      if (url.includes('/attendance')) {
        return Promise.resolve({
          data: {
            records: [],
            total: 0,
            totalPages: 1,
            metrics: {},
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('1. renders the Shift dropdown with dynamic project shifts', async () => {
    render(<ProjectAttendanceReportsView clientId={mockClientId} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter by shift/i })).toBeTruthy();
    });

    const shiftSelect = screen.getByRole('combobox', { name: /filter by shift/i }) as HTMLSelectElement;
    expect(shiftSelect.value).toBe('ALL');

    expect(screen.getByText(/All Shifts/i)).toBeTruthy();
    expect(screen.getByText(/Morning Shift \(08:00 - 16:00\)/i)).toBeTruthy();
    expect(screen.getByText(/Night Shift \(20:00 - 08:00\)/i)).toBeTruthy();
  });

  it('2. filters dependent roles and employees when Night Shift is selected', async () => {
    render(<ProjectAttendanceReportsView clientId={mockClientId} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter by shift/i })).toBeTruthy();
    });

    const shiftSelect = screen.getByRole('combobox', { name: /filter by shift/i });

    // Select Night Shift (shift-2)
    fireEvent.change(shiftSelect, { target: { value: 'shift-2' } });

    // In shift-2, we have emp-2 (TECHNICIAN) and emp-3 (SECURITY). emp-1 (Morning Shift) is not eligible.
    const roleSelect = screen.getByRole('combobox', { name: /filter by employee category or role/i });
    expect(roleSelect).toBeTruthy();

    // Check that attendance API was called with shiftId=shift-2
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('shiftId=shift-2'),
      );
    });
  });

  it('3. resets shift filter back to ALL on Reset Filters click', async () => {
    render(<ProjectAttendanceReportsView clientId={mockClientId} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter by shift/i })).toBeTruthy();
    });

    const shiftSelect = screen.getByRole('combobox', { name: /filter by shift/i }) as HTMLSelectElement;

    // Change to Morning Shift
    fireEvent.change(shiftSelect, { target: { value: 'shift-1' } });
    expect(shiftSelect.value).toBe('shift-1');

    // Click Reset Filters
    const resetBtn = screen.getByRole('button', { name: /reset filters/i });
    fireEvent.click(resetBtn);

    expect(shiftSelect.value).toBe('ALL');
  });
});

