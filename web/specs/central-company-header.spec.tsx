import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CentralCompanyHeader } from '../src/app/central/components/CentralCompanyHeader';

describe('CentralCompanyHeader Component', () => {
  const mockOrganizations = [
    {
      id: 'client-1',
      companyName: 'Atlabs Demo',
      clientCode: 'ATL-001',
      clientLogoUrl: null,
      totalSites: 3,
      totalGuards: 12,
      activePatrols: 2,
      completedPatrols: 15,
      complianceRate: 98,
    },
    {
      id: 'client-2',
      companyName: 'Downtown Tower',
      clientCode: 'DWT-002',
      clientLogoUrl: null,
      totalSites: 1,
      totalGuards: 5,
      activePatrols: 0,
      completedPatrols: 8,
      complianceRate: 92,
    },
    {
      id: 'client-3',
      companyName: 'Marina Residences',
      clientCode: 'MAR-003',
      clientLogoUrl: null,
      totalSites: 2,
      totalGuards: 8,
      activePatrols: 1,
      completedPatrols: 20,
      complianceRate: 100,
    },
  ];

  const defaultProps = {
    selectedClientId: 'client-1',
    organizations: mockOrganizations as any,
    moduleName: 'Reports & Analytics',
    onBackToOrganizations: jest.fn(),
    onSelectOrganization: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders current organization name and switch project button', () => {
    render(<CentralCompanyHeader {...defaultProps} />);

    expect(screen.getByText('Reports & Analytics')).toBeTruthy();
    expect(screen.getAllByText('Atlabs Demo').length).toBe(2);
    expect(screen.getByRole('button', { name: /all projects/i })).toBeTruthy();
  });

  it('calls onBackToOrganizations when "All Projects" button is clicked', () => {
    render(<CentralCompanyHeader {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /all projects/i }));
    expect(defaultProps.onBackToOrganizations).toHaveBeenCalledTimes(1);
  });

  it('opens portal popover when trigger is clicked and displays organization options', () => {
    render(<CentralCompanyHeader {...defaultProps} />);

    const switchBtn = screen.getByRole('button', { name: /switch project|atlabs demo/i });
    expect(switchBtn.getAttribute('aria-expanded')).toBe('false');

    // Click to open
    fireEvent.click(switchBtn);
    expect(switchBtn.getAttribute('aria-expanded')).toBe('true');

    // Popover is mounted in document.body
    const dialog = screen.getByRole('dialog', { name: /switch assigned project/i });
    expect(dialog).toBeTruthy();

    expect(screen.getByText('Downtown Tower')).toBeTruthy();
    expect(screen.getByText('Marina Residences')).toBeTruthy();
    expect(screen.getByText('ATL-001')).toBeTruthy();
    expect(screen.getByText('DWT-002')).toBeTruthy();
  });

  it('selects a different organization when clicked', () => {
    render(<CentralCompanyHeader {...defaultProps} />);

    const switchBtn = screen.getByRole('button', { name: /switch project|atlabs demo/i });
    fireEvent.click(switchBtn);

    const downtownOption = screen.getByRole('menuitem', { name: /downtown tower/i });
    fireEvent.click(downtownOption);

    expect(defaultProps.onSelectOrganization).toHaveBeenCalledWith('client-2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes popover on Escape key press', () => {
    render(<CentralCompanyHeader {...defaultProps} />);

    const switchBtn = screen.getByRole('button', { name: /switch project|atlabs demo/i });
    fireEvent.click(switchBtn);

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes popover on click outside', () => {
    render(
      <div>
        <div data-testid="outside">Outside area</div>
        <CentralCompanyHeader {...defaultProps} />
      </div>,
    );

    const switchBtn = screen.getByRole('button', { name: /switch project|atlabs demo/i });
    fireEvent.click(switchBtn);

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
