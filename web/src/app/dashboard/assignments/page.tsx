'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';
import Modal from '../../components/ui/Modal';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import { FormInput, Select } from '../../components/ui/FormControls';

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

interface Assignment {
  id: string;
  employeeId: string;
  siteId: string;
  shiftId: string;
  assignmentType?: string | null;
  patrolRouteId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  site: {
    id: string;
    name: string;
  };
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  };
  patrolRoute?: {
    id: string;
    name: string;
  } | null;
  assignmentGates?: {
    id: string;
    gate: GateItem;
  }[];
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

  // Dialog / Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // New assignment states
  const [assignmentType, setAssignmentType] = useState<'ROUTE' | 'DIRECT_CHECKPOINTS'>('ROUTE');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedGateIds, setSelectedGateIds] = useState<string[]>([]);

  const [confirmStatus, setConfirmStatus] = useState<{
    isOpen: boolean;
    assignmentId: string;
    guardName: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    assignmentId: '',
    guardName: '',
    targetStatus: false,
  });

  // Query Guard Assignments
  const { data: assignmentsRes, isLoading } = useQuery<ApiResponse<Assignment[]>>({
    queryKey: ['assignments'],
    queryFn: () => apiClient.get('/assignments'),
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

  const activeEmployees = (employeesRes?.data || []).filter((e) => e.status === 'ACTIVE' || e.id === editingAssignment?.employeeId);
  const activeSites = (sitesRes?.data || []).filter((s) => s.isActive || s.id === editingAssignment?.siteId);
  const activeShifts = (shiftsRes?.data || []).filter((s) => s.isActive || s.id === editingAssignment?.shiftId);
  const activeRoutes = (routesRes?.data || []).filter((r) => r.isActive || r.id === editingAssignment?.patrolRouteId);

  const siteOptions = [
    { value: '', label: '-- Select Monitored Site --' },
    ...activeSites.map((s) => ({ value: s.id, label: s.name })),
  ];

  const shiftOptions = [
    { value: '', label: '-- Select Shift Slot --' },
    ...activeShifts.map((s) => ({ value: s.id, label: `${s.name} (${s.startTime} - ${s.endTime})` })),
  ];

  // Dynamic route & gates selection based on selected site in react-hook-form
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AssignmentValues>({
    resolver: zodResolver(assignmentSchema),
  });

  const selectedFormSiteId = watch('siteId');

  const { data: gatesRes } = useQuery<ApiResponse<GateItem[]>>({
    queryKey: ['gates-by-site', selectedFormSiteId],
    queryFn: () => apiClient.get('/gates', { params: { siteId: selectedFormSiteId } }),
    enabled: !!selectedFormSiteId,
  });

  const siteGates = gatesRes?.data || [];

  const filteredRouteOptions = [
    { value: '', label: '-- Select Patrol Route --' },
    ...activeRoutes
      .filter((r) => !selectedFormSiteId || r.siteId === selectedFormSiteId)
      .map((r) => ({ value: r.id, label: r.name })),
  ];

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
        payload.patrolRouteId = values.patrolRouteId;
      } else {
        payload.gateIds = selectedGateIds;
      }

      if (values.effectiveTo) {
        payload.effectiveTo = new Date(values.effectiveTo).toISOString();
      }

      return apiClient.post('/assignments', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Guard assignment(s) created successfully!');
      setIsModalOpen(false);
      reset();
      setSelectedEmployeeIds([]);
      setSelectedGateIds([]);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create assignment.');
    },
  });

  // Update Assignment mutation
  const updateAssignmentMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: AssignmentValues }) => {
      const payload: any = {
        siteId: values.siteId,
        shiftId: values.shiftId,
        assignmentType,
        effectiveFrom: new Date(values.effectiveFrom).toISOString(),
      };
      if (assignmentType === 'ROUTE') {
        payload.patrolRouteId = values.patrolRouteId;
      } else {
        payload.gateIds = selectedGateIds;
      }
      if (values.effectiveTo) {
        payload.effectiveTo = new Date(values.effectiveTo).toISOString();
      } else {
        payload.effectiveTo = null;
      }
      return apiClient.patch(`/assignments/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment settings saved.');
      setIsModalOpen(false);
      setEditingAssignment(null);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update assignment.');
    },
  });

  // Toggle Status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/assignments/${id}/${isActive ? 'activate' : 'deactivate'}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(`Assignment successfully ${vars.isActive ? 'activated' : 'deactivated'}.`);
      setConfirmStatus((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to toggle assignment status.');
      setConfirmStatus((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const handleOpenAdd = () => {
    setEditingAssignment(null);
    setAssignmentType('ROUTE');
    setSelectedEmployeeIds([]);
    setSelectedGateIds([]);
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

  const handleOpenEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setAssignmentType(assignment.assignmentType === 'DIRECT_CHECKPOINTS' ? 'DIRECT_CHECKPOINTS' : 'ROUTE');
    setSelectedEmployeeIds([assignment.employeeId]);
    setSelectedGateIds(assignment.assignmentGates?.map((ag) => ag.gate.id) || []);
    reset({
      employeeId: assignment.employeeId,
      siteId: assignment.siteId,
      shiftId: assignment.shiftId,
      patrolRouteId: assignment.patrolRouteId || '',
      effectiveFrom: new Date(assignment.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: assignment.effectiveTo ? new Date(assignment.effectiveTo).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = (values: AssignmentValues) => {
    if (!editingAssignment && selectedEmployeeIds.length === 0 && !values.employeeId) {
      toast.error('Please select at least one security guard employee.');
      return;
    }
    if (assignmentType === 'ROUTE' && !values.patrolRouteId) {
      toast.error('Please select a patrol route.');
      return;
    }
    if (assignmentType === 'DIRECT_CHECKPOINTS' && selectedGateIds.length === 0) {
      toast.error('Please select at least one checkpoint for direct assignment.');
      return;
    }

    if (editingAssignment) {
      updateAssignmentMutation.mutate({ id: editingAssignment.id, values });
    } else {
      createAssignmentMutation.mutate(values);
    }
  };

  const handleConfirmStatusChange = () => {
    toggleStatusMutation.mutate({
      id: confirmStatus.assignmentId,
      isActive: confirmStatus.targetStatus,
    });
  };

  // Local filtering & pagination
  let assignments = assignmentsRes?.data || [];

  if (search) {
    const s = search.toLowerCase();
    assignments = assignments.filter(
      (c) =>
        c.employee.firstName.toLowerCase().includes(s) ||
        c.employee.lastName.toLowerCase().includes(s) ||
        c.site.name.toLowerCase().includes(s) ||
        c.shift.name.toLowerCase().includes(s)
    );
  }

  if (statusFilter !== 'ALL') {
    const activeBool = statusFilter === 'ACTIVE';
    assignments = assignments.filter((c) => c.isActive === activeBool);
  }

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(assignments.length / limit));
  const paginatedAssignments = assignments.slice((page - 1) * limit, page * limit);

  const columns = [
    {
      key: 'employee',
      label: 'Security Guard',
      render: (row: Assignment) => (
        <div>
          <p style={{ fontWeight: 600, margin: 0 }}>
            {row.employee.firstName} {row.employee.lastName}
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            ID: {row.employee.employeeNumber}
          </span>
        </div>
      ),
    },
    { key: 'site', label: 'Monitored Site', render: (row: Assignment) => row.site.name },
    {
      key: 'shift',
      label: 'Shift slot',
      render: (row: Assignment) => (
        <div>
          <p style={{ margin: 0, fontWeight: 500 }}>{row.shift.name}</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {row.shift.startTime} - {row.shift.endTime}
          </span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Assignment Workflow',
      render: (row: Assignment) => (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            background: row.assignmentType === 'DIRECT_CHECKPOINTS' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: row.assignmentType === 'DIRECT_CHECKPOINTS' ? 'var(--primary)' : 'var(--success)',
          }}
        >
          {row.assignmentType === 'DIRECT_CHECKPOINTS' ? '🚧 Direct Checkpoints' : '🗺️ Patrol Route'}
        </span>
      ),
    },
    {
      key: 'patrolRoute',
      label: 'Assigned Target',
      render: (row: Assignment) => {
        if (row.assignmentType === 'DIRECT_CHECKPOINTS') {
          const count = row.assignmentGates?.length || 0;
          return (
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{count} Checkpoint{count === 1 ? '' : 's'}</p>
              {row.assignmentGates && row.assignmentGates.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {row.assignmentGates.map((ag) => ag.gate.name).slice(0, 2).join(', ')}
                  {row.assignmentGates.length > 2 ? '...' : ''}
                </span>
              )}
            </div>
          );
        }
        return <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{row.patrolRoute?.name || 'N/A'}</span>;
      },
    },
    {
      key: 'dates',
      label: 'Effective Period',
      render: (row: Assignment) => (
        <span style={{ fontSize: '0.85rem' }}>
          {new Date(row.effectiveFrom).toLocaleDateString()} -{' '}
          {row.effectiveTo ? new Date(row.effectiveTo).toLocaleDateString() : 'Continuous'}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: Assignment) => <StatusChip status={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Assignment) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleOpenEdit(row)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </button>
          <button
            onClick={() =>
              setConfirmStatus({
                isOpen: true,
                assignmentId: row.id,
                guardName: `${row.employee.firstName} ${row.employee.lastName}`,
                targetStatus: !row.isActive,
              })
            }
            className="btn btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.8rem',
              gap: '4px',
              color: row.isActive ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {row.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            <span>{row.isActive ? 'Deactivate' : 'Activate'}</span>
          </button>
        </div>
      ),
    },
  ];

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
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', maxWidth: '640px' }}>
          <SearchBar
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search assignments by guard name, site or shift..."
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '180px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary" style={{ gap: '8px' }}>
          <Plus size={16} />
          <span>Assign Guard Staff</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={paginatedAssignments}
        isLoading={isLoading}
        emptyMessage="No guard assignments registered."
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />

      {/* CREATE / EDIT ASSIGNMENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? 'Modify Active Guard Assignment' : 'Assign Guard Staff'}
      >
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* WORKFLOW TYPE SELECTOR */}
          <div>
            <label className="form-label">Assignment Model</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                🚧 Direct Checkpoints
              </button>
            </div>
          </div>

          {/* GUARD EMPLOYEE SELECTION */}
          {!editingAssignment ? (
            <div>
              <label className="form-label">Select Security Guard Staff (Multiple allowed)</label>
              <div
                style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '8px',
                  background: 'var(--surface-color)',
                }}
              >
                {activeEmployees.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No active guards available.</p>
                ) : (
                  activeEmployees.map((emp) => {
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
                          background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployeeIds((prev) => [...prev, emp.id]);
                            } else {
                              setSelectedEmployeeIds((prev) => prev.filter((id) => id !== emp.id));
                            }
                          }}
                        />
                        <span>{emp.firstName} {emp.lastName} ({emp.employeeNumber})</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="form-label">Assigned Employee</label>
              <input
                type="text"
                className="form-input"
                disabled
                style={{ opacity: 0.7 }}
                value={`${editingAssignment.employee.firstName} ${editingAssignment.employee.lastName} (${editingAssignment.employee.employeeNumber})`}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
            <Select
              label="Select Patrol Route"
              options={filteredRouteOptions}
              error={errors.patrolRouteId?.message}
              {...register('patrolRouteId')}
              disabled={!selectedFormSiteId}
            />
          ) : (
            <div>
              <label className="form-label">Select Direct Checkpoints (Multiple allowed)</label>
              {!selectedFormSiteId ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Please select a site first to load checkpoints.</p>
              ) : siteGates.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No checkpoints registered at this site.</p>
              ) : (
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
                          background: isChecked ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGateIds((prev) => [...prev, gate.id]);
                            } else {
                              setSelectedGateIds((prev) => prev.filter((id) => id !== gate.id));
                            }
                          }}
                        />
                        <span>🚧 {gate.name} ({gate.gateCode})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
            disabled={createAssignmentMutation.isPending || updateAssignmentMutation.isPending}
          >
            {createAssignmentMutation.isPending || updateAssignmentMutation.isPending
              ? 'Saving assignments...'
              : editingAssignment
              ? 'Save Assignment'
              : 'Add Assignment'}
          </button>
        </form>
      </Modal>

      {/* CONFIRM STATUS TOGGLE */}
      <ConfirmationDialog
        isOpen={confirmStatus.isOpen}
        onClose={() => setConfirmStatus((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmStatusChange}
        title={confirmStatus.targetStatus ? 'Activate Assignment' : 'Deactivate Assignment'}
        description={`Are you sure you want to ${
          confirmStatus.targetStatus ? 'activate' : 'deactivate'
        } assignment for guard "${confirmStatus.guardName}"?`}
        confirmText={confirmStatus.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!confirmStatus.targetStatus}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}
