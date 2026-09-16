'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Eye, Plus, ToggleLeft, ToggleRight } from 'lucide-react';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import DataTable from '../../components/ui/DataTable';

import { FormInput, Select } from '../../components/ui/FormControls';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';
import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  status: string;
  designation?: string | null;
  user?: {
    role: string;
  } | null;
}

export function getRoleLabel(emp: {
  designation?: string | null;
  user?: { role: string } | null;
}): string {
  const rawRole = (
    emp.user?.role ||
    emp.designation ||
    'SECURITY'
  ).toUpperCase();
  switch (rawRole) {
    case 'CLEANER':
      return 'House Keeping';
    case 'TECHNICIAN':
      return 'Technician';
    case 'SERVICE_ENGINEER':
      return 'Service Engineer';
    case 'PLUMBER':
      return 'Plumber';
    case 'LIFE_GUARD':
    case 'LIFEGUARD':
      return 'Lifeguard';
    case 'SUPERVISOR':
      return 'Supervisor';
    case 'MANAGER':
      return 'Manager';
    case 'SECURITY':
    case 'SECURITY_GUARD':
    default:
      return 'Security Guard';
  }
}

interface Site {
  id: string;
  name: string;
  isActive: boolean;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface PatrolRoute {
  id: string;
  name: string;
  siteId: string;
  isActive: boolean;
}

interface GateItem {
  id: string;
  gateCode: string;
  name: string;
  siteId: string;
}

interface EmployeeSummary {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation?: string | null;
  role: string;
  employeeStatus: string;
  totalAssignments: number;
  activeAssignments: number;
  inactiveAssignments: number;
  status: 'ACTIVE' | 'INACTIVE';
  sites: { id: string; name: string }[];
  shifts: { id: string; name: string; startTime: string; endTime: string }[];
}

interface SummaryApiResponse {
  success: boolean;
  data: EmployeeSummary[];
  pagination: {
    page: number;
    limit: number;
    totalEmployees: number;
    totalPages: number;
  };
}

const assignmentSchema = z.object({
  employeeId: z.string().optional(),
  siteId: z.string().min(1, 'Please select a site location'),
  shiftId: z.string().min(1, 'Please select a shift slot'),
  patrolRouteId: z.string().optional(),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().optional().or(z.literal('')),
});

type AssignmentValues = z.infer<typeof assignmentSchema>;

export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Dialog / Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmEmployee, setConfirmEmployee] = useState<{
    summary: EmployeeSummary;
    action: 'ACTIVATE' | 'DEACTIVATE';
  } | null>(null);

  // Deactivate Employee Assignments mutation
  const deactivateEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) =>
      apiClient.patch(`/assignments/employees/${employeeId}/deactivate`),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['assignment-employees'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      const msg =
        res?.data?.message ||
        res?.message ||
        'Assignments deactivated successfully.';
      toast.success(msg);
      setConfirmEmployee(null);
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          'Failed to deactivate employee assignments.',
      );
    },
  });

  // Activate Employee Assignments mutation
  const activateEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) =>
      apiClient.patch(`/assignments/employees/${employeeId}/activate`),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['assignment-employees'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      const msg =
        res?.data?.message ||
        res?.message ||
        'Assignments activated successfully.';
      toast.success(msg);
      setConfirmEmployee(null);
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          'Failed to activate employee assignments.',
      );
    },
  });

  // New assignment states
  const [assignmentType, setAssignmentType] = useState<
    'ROUTE' | 'DIRECT_CHECKPOINTS'
  >('ROUTE');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [selectedGateIds, setSelectedGateIds] = useState<string[]>([]);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const routeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        routeDropdownRef.current &&
        !routeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRouteDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRouteDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Query Employee Summaries (Level 1)
  const { data: summaryRes, isLoading } = useQuery<SummaryApiResponse>({
    queryKey: ['assignment-employees', page, search, statusFilter, roleFilter],
    queryFn: () =>
      apiClient.get('/assignments/employees', {
        params: { page, limit: 10, search, status: statusFilter, role: roleFilter },
      }),
  });

  // Query dependencies for dropdowns
  const { data: employeesRes } = useQuery<ApiResponse<Employee[]>>({
    queryKey: ['employees-dropdown'],
    queryFn: () => apiClient.get('/employees'),
  });

  const { data: sitesRes } = useQuery<ApiResponse<Site[]>>({
    queryKey: ['sites-dropdown'],
    queryFn: () => apiClient.get('/sites'),
  });

  const { data: shiftsRes } = useQuery<ApiResponse<Shift[]>>({
    queryKey: ['shifts-dropdown'],
    queryFn: () => apiClient.get('/shifts'),
  });

  const { data: routesRes } = useQuery<ApiResponse<PatrolRoute[]>>({
    queryKey: ['routes-dropdown'],
    queryFn: () => apiClient.get('/patrol-routes'),
  });

  const activeEmployees = (employeesRes?.data || []).filter(
    (e) => e.status === 'ACTIVE',
  );
  const activeSites = (sitesRes?.data || []).filter((s) => s.isActive);
  const activeShifts = (shiftsRes?.data || []).filter((s) => s.isActive);
  const activeRoutes = (routesRes?.data || []).filter((r) => r.isActive);

  const siteOptions = [
    { value: '', label: '-- Select Monitored Site --' },
    ...activeSites.map((s) => ({ value: s.id, label: s.name })),
  ];

  const shiftOptions = [
    { value: '', label: '-- Select Shift Slot --' },
    ...activeShifts.map((s) => ({
      value: s.id,
      label: `${s.name} (${s.startTime} - ${s.endTime})`,
    })),
  ];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AssignmentValues>({
    resolver: zodResolver(assignmentSchema as any),
  });

  const selectedFormSiteId = watch('siteId');

  useEffect(() => {
    setSelectedRouteIds([]);
    setIsRouteDropdownOpen(false);
  }, [selectedFormSiteId]);

  const { data: gatesRes } = useQuery<ApiResponse<GateItem[]>>({
    queryKey: ['gates', selectedFormSiteId, 'active'],
    queryFn: () =>
      apiClient.get('/gates', { params: { siteId: selectedFormSiteId, isActive: true } }),
    enabled: !!selectedFormSiteId,
  });

  const siteGates = gatesRes?.data || [];

  const { data: siteFloorsRes } = useQuery<
    ApiResponse<{ floor: string; totalCheckpoints: number; activeCheckpoints: number }[]>
  >({
    queryKey: ['floors', selectedFormSiteId],
    queryFn: () => apiClient.get('/gates/floors', { params: { siteId: selectedFormSiteId } }),
    enabled: !!selectedFormSiteId && assignmentType === 'DIRECT_CHECKPOINTS',
  });

  const siteFloors = siteFloorsRes?.data || [];

  const availableRoutesForSite = activeRoutes.filter(
    (r) => selectedFormSiteId && r.siteId === selectedFormSiteId,
  );

  // Create Assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: (values: AssignmentValues) => {
      const payload: any = {
        siteId: values.siteId,
        shiftId: values.shiftId,
        assignmentType,
        effectiveFrom: new Date(values.effectiveFrom).toISOString(),
      };

      if (selectedEmployeeIds.length > 0) {
        payload.employeeIds = selectedEmployeeIds;
      } else if (values.employeeId) {
        payload.employeeId = values.employeeId;
      }

      if (assignmentType === 'ROUTE') {
        if (selectedRouteIds.length > 0) {
          payload.patrolRouteIds = selectedRouteIds;
        } else if (values.patrolRouteId) {
          payload.patrolRouteId = values.patrolRouteId;
        }
      } else {
        payload.gateIds = selectedGateIds;
      }

      if (values.effectiveTo) {
        payload.effectiveTo = new Date(values.effectiveTo).toISOString();
      }

      return apiClient.post('/assignments', payload);
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['assignment-employees'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      const data = res?.data || res;
      if (typeof data?.createdCount === 'number') {
        const createdMsg = `${data.createdCount} guard assignment(s) created successfully.`;
        const skippedMsg =
          data.skippedCount > 0
            ? ` ${data.skippedCount} existing assignment(s) skipped.`
            : '';
        toast.success(`${createdMsg}${skippedMsg}`);
      } else {
        toast.success('Guard assignment(s) created successfully!');
      }
      setIsModalOpen(false);
      reset();
      setSelectedEmployeeIds([]);
      setSelectedRouteIds([]);
      setSelectedGateIds([]);
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || 'Failed to create assignment.',
      );
    },
  });

  const handleOpenAdd = () => {
    setAssignmentType('ROUTE');
    setSelectedEmployeeIds([]);
    setSelectedRouteIds([]);
    setSelectedGateIds([]);
    setIsRouteDropdownOpen(false);
    reset({
      employeeId: '',
      siteId: '',
      shiftId: '',
      patrolRouteId: '',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = (values: AssignmentValues) => {
    if (selectedEmployeeIds.length === 0 && !values.employeeId) {
      toast.error('Please select at least one staff member.');
      return;
    }
    if (
      assignmentType === 'ROUTE' &&
      selectedRouteIds.length === 0 &&
      !values.patrolRouteId
    ) {
      toast.error('Please select at least one patrol route.');
      return;
    }
    if (
      assignmentType === 'DIRECT_CHECKPOINTS' &&
      selectedGateIds.length === 0
    ) {
      toast.error(
        'Please select at least one checkpoint for direct assignment.',
      );
      return;
    }

    createAssignmentMutation.mutate(values);
  };

  const employeeSummaries = summaryRes?.data || [];
  const totalPages = summaryRes?.pagination?.totalPages || 1;

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (row: EmployeeSummary) => (
        <div>
          <p style={{ fontWeight: 600, margin: 0 }}>{row.employeeName}</p>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}
          >
            ID: {row.employeeCode}
          </span>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row: EmployeeSummary) => (
        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
          {getRoleLabel({ designation: row.designation, user: { role: row.role } })}
        </span>
      ),
    },
    {
      key: 'sites',
      label: 'Monitored Site(s)',
      render: (row: EmployeeSummary) => {
        if (!row.sites || row.sites.length === 0) {
          return <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None</span>;
        }
        const firstSite = row.sites[0].name;
        const extraCount = row.sites.length - 1;
        const allSitesTooltip = row.sites.map((s) => s.name).join(', ');

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{firstSite}</span>
            {extraCount > 0 && (
              <span
                title={allSitesTooltip}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--primary)',
                  cursor: 'help',
                }}
              >
                +{extraCount} more
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'shifts',
      label: 'Shift(s)',
      render: (row: EmployeeSummary) => {
        if (!row.shifts || row.shifts.length === 0) {
          return <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None</span>;
        }
        const firstShift = row.shifts[0].name;
        const extraCount = row.shifts.length - 1;
        const allShiftsTooltip = row.shifts
          .map((s) => `${s.name} (${s.startTime}-${s.endTime})`)
          .join(', ');

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{firstShift}</span>
            {extraCount > 0 && (
              <span
                title={allShiftsTooltip}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: 'rgba(100, 116, 139, 0.15)',
                  color: 'var(--text-secondary)',
                  cursor: 'help',
                }}
              >
                +{extraCount} more
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'assignments',
      label: 'Assignments',
      render: (row: EmployeeSummary) => (
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
          }}
        >
          {row.totalAssignments} Assignment{row.totalAssignments === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      key: 'active',
      label: 'Active',
      render: (row: EmployeeSummary) => (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--success)',
            }}
          >
            {row.activeAssignments} Active
          </span>
          {row.inactiveAssignments > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger)',
              }}
            >
              {row.inactiveAssignments} Inactive
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: EmployeeSummary) => (
        <StatusChip status={row.status === 'ACTIVE'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: EmployeeSummary) => {
        const isRowActive = row.activeAssignments > 0;
        const isPending =
          (deactivateEmployeeMutation.isPending &&
            confirmEmployee?.summary.employeeId === row.employeeId) ||
          (activateEmployeeMutation.isPending &&
            confirmEmployee?.summary.employeeId === row.employeeId);

        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link
              href={`/dashboard/assignments/${row.employeeId}`}
              className="btn btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Eye size={14} />
              <span>View Details</span>
            </Link>
            <button
              onClick={() =>
                setConfirmEmployee({
                  summary: row,
                  action: isRowActive ? 'DEACTIVATE' : 'ACTIVATE',
                })
              }
              disabled={isPending}
              className="btn btn-secondary"
              style={{
                padding: '6px 10px',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: isRowActive ? 'var(--danger)' : 'var(--success)',
                opacity: isPending ? 0.6 : 1,
              }}
              title={
                isRowActive
                  ? 'Deactivate Employee Assignments'
                  : 'Activate Employee Assignments'
              }
            >
              {isRowActive ? (
                <ToggleLeft size={16} />
              ) : (
                <ToggleRight size={16} />
              )}
              <span>{isRowActive ? 'Deactivate' : 'Activate'}</span>
            </button>
          </div>
        );
      },
    },
  ];

  const isAllGuardsSelected =
    activeEmployees.length > 0 &&
    activeEmployees.every((emp) => selectedEmployeeIds.includes(emp.id));

  const isSomeGuardsSelected =
    selectedEmployeeIds.length > 0 && !isAllGuardsSelected;

  const isAllRoutesSelected =
    availableRoutesForSite.length > 0 &&
    availableRoutesForSite.every((r) => selectedRouteIds.includes(r.id));

  const isSomeRoutesSelected =
    selectedRouteIds.length > 0 && !isAllRoutesSelected;

  const getRouteDropdownLabel = () => {
    if (!selectedFormSiteId) return '-- Select Monitored Site First --';
    if (availableRoutesForSite.length === 0)
      return 'No patrol routes registered for this site';
    if (selectedRouteIds.length === 0) return '-- Select Patrol Routes --';
    if (selectedRouteIds.length === 1) {
      const r = availableRoutesForSite.find(
        (r) => r.id === selectedRouteIds[0],
      );
      return r ? r.name : '1 route selected';
    }
    if (selectedRouteIds.length === availableRoutesForSite.length) {
      return `All routes selected (${availableRoutesForSite.length})`;
    }
    return `${selectedRouteIds.length} routes selected`;
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            width: '100%',
            maxWidth: '740px',
          }}
        >
          <SearchBar
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by employee name or ID..."
          />

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '170px' }}
          >
            <option value="ALL">All Roles</option>
            <option value="SECURITY">Security Guard</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="TECHNICIAN">Technician</option>
            <option value="CLEANER">House Keeping</option>
            <option value="SERVICE_ENGINEER">Service Engineer</option>
            <option value="LIFE_GUARD">Lifeguard</option>
            <option value="PLUMBER">Plumber</option>
            <option value="MANAGER">Manager</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '190px' }}
          >
            <option value="ALL">All Assignments</option>
            <option value="ACTIVE">Has Active Assignments</option>
            <option value="INACTIVE">Inactive Assignments</option>
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn btn-primary"
          style={{ gap: '8px' }}
        >
          <Plus size={16} />
          <span>Assign Guard Staff</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={employeeSummaries}
        isLoading={isLoading}
        emptyMessage="No employee assignments found for the selected filters."
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />

      {/* STATUS TOGGLE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!confirmEmployee}
        onClose={() => setConfirmEmployee(null)}
        title={
          confirmEmployee?.action === 'DEACTIVATE'
            ? 'Deactivate Assignments?'
            : 'Activate Assignments?'
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.95rem',
              lineHeight: 1.5,
              color: 'var(--text-color)',
            }}
          >
            {confirmEmployee?.action === 'DEACTIVATE'
              ? `This will deactivate all active assignments for ${confirmEmployee?.summary.employeeName}.`
              : `This will reactivate eligible inactive assignments for ${confirmEmployee?.summary.employeeName}.`}
          </p>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background:
                confirmEmployee?.action === 'DEACTIVATE'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : 'rgba(16, 185, 129, 0.08)',
              border:
                confirmEmployee?.action === 'DEACTIVATE'
                  ? '1px solid rgba(239, 68, 68, 0.2)'
                  : '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            {confirmEmployee?.action === 'DEACTIVATE' ? (
              <>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 600,
                    color: 'var(--danger)',
                    fontSize: '0.9rem',
                  }}
                >
                  {confirmEmployee.summary.activeAssignments}{' '}
                  {confirmEmployee.summary.activeAssignments === 1
                    ? 'active assignment'
                    : 'active assignments'}{' '}
                  will be deactivated.
                </p>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  The employee account and patrol history will not be deleted.
                </p>
              </>
            ) : (
              <>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 600,
                    color: 'var(--success)',
                    fontSize: '0.9rem',
                  }}
                >
                  {confirmEmployee?.summary.inactiveAssignments}{' '}
                  {confirmEmployee?.summary.inactiveAssignments === 1
                    ? 'inactive assignment'
                    : 'inactive assignments'}{' '}
                  will be evaluated for reactivation.
                </p>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Expired or inactive route assignments will be safely skipped.
                </p>
              </>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '8px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmEmployee(null)}
              disabled={
                deactivateEmployeeMutation.isPending ||
                activateEmployeeMutation.isPending
              }
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${confirmEmployee?.action === 'DEACTIVATE' ? 'btn-danger' : 'btn-primary'}`}
              style={
                confirmEmployee?.action === 'DEACTIVATE'
                  ? { background: 'var(--danger)', color: '#fff' }
                  : {}
              }
              onClick={() => {
                if (confirmEmployee) {
                  if (confirmEmployee.action === 'DEACTIVATE') {
                    deactivateEmployeeMutation.mutate(
                      confirmEmployee.summary.employeeId,
                    );
                  } else {
                    activateEmployeeMutation.mutate(
                      confirmEmployee.summary.employeeId,
                    );
                  }
                }
              }}
              disabled={
                deactivateEmployeeMutation.isPending ||
                activateEmployeeMutation.isPending
              }
            >
              {deactivateEmployeeMutation.isPending ||
              activateEmployeeMutation.isPending
                ? 'Processing...'
                : confirmEmployee?.action === 'DEACTIVATE'
                ? 'Deactivate'
                : 'Activate'}
            </button>
          </div>
        </div>
      </Modal>

      {/* CREATE ASSIGNMENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsRouteDropdownOpen(false);
        }}
        title="Assign Guard Staff"
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* WORKFLOW TYPE SELECTOR */}
          <div>
            <label className="form-label">Assignment Model</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}
            >
              <button
                type="button"
                className={`btn ${assignmentType === 'ROUTE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                onClick={() => setAssignmentType('ROUTE')}
              >
                🗺️ Patrol Route
              </button>
              <button
                type="button"
                className={`btn ${assignmentType === 'DIRECT_CHECKPOINTS' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                onClick={() => setAssignmentType('DIRECT_CHECKPOINTS')}
              >
                🚧 Checkpoints
              </button>
            </div>
          </div>

          {/* GUARD EMPLOYEE SELECTION */}
          <div>
            <label className="form-label">
              Select Security Guard Staff (Multiple allowed)
            </label>
            <div
              style={{
                maxHeight: '140px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '8px',
                background: 'var(--surface-color)',
              }}
            >
              {activeEmployees.length === 0 ? (
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: 0,
                  }}
                >
                  No active guards available.
                </p>
              ) : (
                <>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderBottom: '1px solid var(--border-color)',
                      marginBottom: '4px',
                      background: isAllGuardsSelected
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isAllGuardsSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeGuardsSelected;
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployeeIds(
                            activeEmployees.map((emp) => emp.id),
                          );
                        } else {
                          setSelectedEmployeeIds([]);
                        }
                      }}
                    />
                    <span>Select All ({activeEmployees.length})</span>
                  </label>

                  {activeEmployees.map((emp) => {
                    const isSelected = selectedEmployeeIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 6px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          background: isSelected
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployeeIds((prev) => [
                                ...prev,
                                emp.id,
                              ]);
                            } else {
                              setSelectedEmployeeIds((prev) =>
                                prev.filter((id) => id !== emp.id),
                              );
                            }
                          }}
                        />
                        <span>
                          {emp.firstName} {emp.lastName} &mdash;{' '}
                          {getRoleLabel(emp)} ({emp.employeeNumber})
                        </span>
                      </label>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <Select
              label="Select Monitored Site"
              options={siteOptions}
              error={errors.siteId?.message}
              {...register('siteId')}
            />

            <Select
              label="Select Shift Slot"
              options={shiftOptions}
              error={errors.shiftId?.message}
              {...register('shiftId')}
            />
          </div>

          {/* TARGET SELECTION: ROUTE OR DIRECT GATES */}
          {assignmentType === 'ROUTE' ? (
            <div>
              <label className="form-label">
                Select Patrol Routes (Multiple allowed)
              </label>
              <div ref={routeDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="form-input"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor:
                      selectedFormSiteId && availableRoutesForSite.length > 0
                        ? 'pointer'
                        : 'not-allowed',
                    opacity:
                      selectedFormSiteId && availableRoutesForSite.length > 0
                        ? 1
                        : 0.6,
                    textAlign: 'left',
                    width: '100%',
                    borderColor: isRouteDropdownOpen
                      ? 'var(--primary)'
                      : undefined,
                  }}
                  disabled={
                    !selectedFormSiteId || availableRoutesForSite.length === 0
                  }
                  onClick={() => setIsRouteDropdownOpen((prev) => !prev)}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '0.85rem',
                      color:
                        selectedRouteIds.length > 0
                          ? 'var(--text-color)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {getRouteDropdownLabel()}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{
                      opacity: 0.7,
                      transition: 'transform 0.2s ease',
                      transform: isRouteDropdownOpen
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                    }}
                  />
                </button>

                {isRouteDropdownOpen &&
                  selectedFormSiteId &&
                  availableRoutesForSite.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        maxHeight: '240px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '6px',
                        background: 'var(--bg-secondary, #1e293b)',
                        backdropFilter: 'blur(12px)',
                        boxShadow:
                          '0 12px 24px -4px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          borderBottom: '1px solid var(--border-color)',
                          marginBottom: '4px',
                          background: isAllRoutesSelected
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isAllRoutesSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isSomeRoutesSelected;
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRouteIds(
                                availableRoutesForSite.map((r) => r.id),
                              );
                            } else {
                              setSelectedRouteIds([]);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>
                          Select All ({availableRoutesForSite.length})
                        </span>
                      </label>

                      {availableRoutesForSite.map((route) => {
                        const isChecked = selectedRouteIds.includes(route.id);
                        return (
                          <label
                            key={route.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '7px 10px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                              borderRadius: '4px',
                              transition: 'background 0.15s ease',
                              background: isChecked
                                ? 'rgba(59, 130, 246, 0.15)'
                                : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRouteIds((prev) => [
                                    ...prev,
                                    route.id,
                                  ]);
                                } else {
                                  setSelectedRouteIds((prev) =>
                                    prev.filter((id) => id !== route.id),
                                  );
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <span>🗺️ {route.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div>
              <label className="form-label">
                Select Direct Checkpoints (Multiple allowed)
              </label>
              {!selectedFormSiteId ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Please select a site first to load checkpoints.
                </p>
              ) : siteGates.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No checkpoints registered at this site.
                </p>
              ) : (
                <>
                  {siteFloors.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <select
                        onChange={async (e) => {
                          const chosenFloor = e.target.value;
                          if (!chosenFloor) return;
                          try {
                            const res: any = await apiClient.get('/gates', {
                              params: { siteId: selectedFormSiteId, floor: chosenFloor, isActive: true },
                            });
                            const floorGates: GateItem[] = Array.isArray(res?.data)
                              ? res.data
                              : res?.data?.items || [];
                            const floorGateIds = floorGates.map((g) => g.id);
                            setSelectedGateIds((prev) => Array.from(new Set([...prev, ...floorGateIds])));
                            toast.success(`Selected ${floorGateIds.length} active checkpoint(s) on ${chosenFloor}`);
                          } catch (err) {
                            toast.error('Failed to load floor checkpoints.');
                          }
                        }}
                        className="form-input"
                        style={{ fontSize: '0.85rem' }}
                        defaultValue=""
                      >
                        <option value="">-- Bulk Select Checkpoints by Floor --</option>
                        {siteFloors.map((f) => (
                          <option key={f.floor} value={f.floor}>
                            🏢 {f.floor} ({f.activeCheckpoints} active checkpoints)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div
                    style={{
                      maxHeight: '140px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '8px',
                      background: 'var(--surface-color)',
                    }}
                  >
                  {siteGates.map((gate) => {
                    const isChecked = selectedGateIds.includes(gate.id);
                    return (
                      <label
                        key={gate.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          borderRadius: '4px',
                          background: isChecked
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGateIds((prev) => [...prev, gate.id]);
                            } else {
                              setSelectedGateIds((prev) =>
                                prev.filter((id) => id !== gate.id),
                              );
                            }
                          }}
                        />
                        <span>
                          🚧 {gate.name} ({gate.gateCode})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <FormInput
              label="Effective From"
              type="date"
              error={errors.effectiveFrom?.message}
              {...register('effectiveFrom')}
            />

            <FormInput
              label="Effective To (Optional)"
              type="date"
              error={errors.effectiveTo?.message}
              {...register('effectiveTo')}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px' }}
            disabled={createAssignmentMutation.isPending}
          >
            {createAssignmentMutation.isPending
              ? 'Saving assignments...'
              : 'Add Assignment'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
