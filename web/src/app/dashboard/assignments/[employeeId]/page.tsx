'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import DataTable from '../../../components/ui/DataTable';
import { FormInput, Select } from '../../../components/ui/FormControls';
import Modal from '../../../components/ui/Modal';
import StatusChip from '../../../components/ui/StatusChip';
import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import { formatPatrolDate } from '../../../../lib/date-formatter';
import { getRoleLabel } from '../page';

interface EmployeeDetail {
  id: string;
  firstName: string;
  lastName: string | null;
  employeeNumber: string;
  designation: string | null;
  role: string;
  status: string;
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

interface EmployeeAssignmentResponse {
  success: boolean;
  data: {
    employee: EmployeeDetail;
    assignments: Assignment[];
  };
}

const assignmentSchema = z.object({
  siteId: z.string().min(1, 'Please select a site location'),
  shiftId: z.string().min(1, 'Please select a shift slot'),
  patrolRouteId: z.string().optional(),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().optional().or(z.literal('')),
});

type AssignmentValues = z.infer<typeof assignmentSchema>;

export default function EmployeeAssignmentsDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const resolvedParams = use(params);
  const employeeId = resolvedParams.employeeId;

  const queryClient = useQueryClient();

  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [assignmentType, setAssignmentType] = useState<
    'ROUTE' | 'DIRECT_CHECKPOINTS'
  >('ROUTE');
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [selectedGateIds, setSelectedGateIds] = useState<string[]>([]);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const routeDropdownRef = useRef<HTMLDivElement>(null);

  const [confirmStatus, setConfirmStatus] = useState<{
    isOpen: boolean;
    assignmentId: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    assignmentId: '',
    targetStatus: false,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        routeDropdownRef.current &&
        !routeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRouteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Employee Assignments
  const { data: detailRes, isLoading, isError } = useQuery<EmployeeAssignmentResponse>({
    queryKey: ['employee-assignments', employeeId],
    queryFn: () => apiClient.get(`/assignments/employees/${employeeId}`),
  });

  // Query dependencies for editing dropdowns
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

  const activeSites = (sitesRes?.data || []).filter(
    (s) => s.isActive || s.id === editingAssignment?.siteId,
  );
  const activeShifts = (shiftsRes?.data || []).filter(
    (s) => s.isActive || s.id === editingAssignment?.shiftId,
  );
  const activeRoutes = (routesRes?.data || []).filter(
    (r) => r.isActive || r.id === editingAssignment?.patrolRouteId,
  );

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

  const { data: gatesRes } = useQuery<ApiResponse<GateItem[]>>({
    queryKey: ['gates', selectedFormSiteId, 'active'],
    queryFn: () =>
      apiClient.get('/gates', { params: { siteId: selectedFormSiteId, isActive: true } }),
    enabled: !!selectedFormSiteId,
  });

  const siteGates = gatesRes?.data || [];
  const availableRoutesForSite = activeRoutes.filter(
    (r) => selectedFormSiteId && r.siteId === selectedFormSiteId,
  );

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
        if (selectedRouteIds.length > 0) {
          payload.patrolRouteId = selectedRouteIds[0];
        } else if (values.patrolRouteId) {
          payload.patrolRouteId = values.patrolRouteId;
        }
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
      queryClient.invalidateQueries({ queryKey: ['employee-assignments', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['assignment-employees'] });
      toast.success('Assignment settings saved.');
      setIsModalOpen(false);
      setEditingAssignment(null);
      reset();
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || 'Failed to update assignment.',
      );
    },
  });

  // Toggle Status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(
        `/assignments/${id}/${isActive ? 'activate' : 'deactivate'}`,
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['employee-assignments', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['assignment-employees'] });
      toast.success(
        `Assignment successfully ${vars.isActive ? 'activated' : 'deactivated'}.`,
      );
      setConfirmStatus((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || 'Failed to toggle assignment status.',
      );
      setConfirmStatus((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const handleOpenEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setAssignmentType(
      assignment.assignmentType === 'DIRECT_CHECKPOINTS'
        ? 'DIRECT_CHECKPOINTS'
        : 'ROUTE',
    );
    setSelectedRouteIds(
      assignment.patrolRouteId ? [assignment.patrolRouteId] : [],
    );
    setSelectedGateIds(
      assignment.assignmentGates?.map((ag) => ag.gate.id) || [],
    );
    setIsRouteDropdownOpen(false);
    reset({
      siteId: assignment.siteId,
      shiftId: assignment.shiftId,
      patrolRouteId: assignment.patrolRouteId || '',
      effectiveFrom: new Date(assignment.effectiveFrom)
        .toISOString()
        .split('T')[0],
      effectiveTo: assignment.effectiveTo
        ? new Date(assignment.effectiveTo).toISOString().split('T')[0]
        : '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = (values: AssignmentValues) => {
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

    if (editingAssignment) {
      updateAssignmentMutation.mutate({ id: editingAssignment.id, values });
    }
  };

  const handleConfirmStatusChange = () => {
    toggleStatusMutation.mutate({
      id: confirmStatus.assignmentId,
      isActive: confirmStatus.targetStatus,
    });
  };

  const employeeData = detailRes?.data?.employee;
  const assignments = detailRes?.data?.assignments || [];

  const activeAssignmentsCount = assignments.filter((a) => a.isActive).length;
  const inactiveAssignmentsCount = assignments.filter((a) => !a.isActive).length;

  const columns = [
    {
      key: 'site',
      label: 'Monitored Site',
      render: (row: Assignment) => (
        <span style={{ fontWeight: 600 }}>{row.site.name}</span>
      ),
    },
    {
      key: 'shift',
      label: 'Shift Slot',
      render: (row: Assignment) => (
        <div>
          <p style={{ margin: 0, fontWeight: 500 }}>{row.shift.name}</p>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}
          >
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
            background:
              row.assignmentType === 'DIRECT_CHECKPOINTS'
                ? 'rgba(59, 130, 246, 0.15)'
                : 'rgba(16, 185, 129, 0.15)',
            color:
              row.assignmentType === 'DIRECT_CHECKPOINTS'
                ? 'var(--primary)'
                : 'var(--success)',
          }}
        >
          {row.assignmentType === 'DIRECT_CHECKPOINTS'
            ? '🚧 Checkpoints'
            : '🗺️ Patrol Route'}
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
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
                {count} Checkpoint{count === 1 ? '' : 's'}
              </p>
              {row.assignmentGates && row.assignmentGates.length > 0 && (
                <span
                  style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                >
                  {row.assignmentGates
                    .map((ag) => ag.gate.name)
                    .slice(0, 2)
                    .join(', ')}
                  {row.assignmentGates.length > 2 ? '...' : ''}
                </span>
              )}
            </div>
          );
        }
        return (
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            {row.patrolRoute?.name || 'N/A'}
          </span>
        );
      },
    },
    {
      key: 'dates',
      label: 'Effective Period',
      render: (row: Assignment) => (
        <span style={{ fontSize: '0.85rem' }}>
          {formatPatrolDate(row.effectiveFrom)} -{' '}
          {row.effectiveTo
            ? formatPatrolDate(row.effectiveTo)
            : 'Continuous'}
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
            {row.isActive ? (
              <ToggleLeft size={16} />
            ) : (
              <ToggleRight size={16} />
            )}
            <span>{row.isActive ? 'Deactivate' : 'Activate'}</span>
          </button>
        </div>
      ),
    },
  ];

  if (isError) {
    return (
      <div style={{ padding: '24px' }}>
        <Link
          href="/dashboard/assignments"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Assignments</span>
        </Link>
        <p style={{ color: 'var(--danger)' }}>
          Failed to load employee assignment details or unauthorized access.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* HEADER / NAVIGATION */}
      <div style={{ marginBottom: '20px' }}>
        <Link
          href="/dashboard/assignments"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Assignments</span>
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Employee Assignment Details
        </h1>
      </div>

      {/* EMPLOYEE INFORMATION CARD */}
      {employeeData && (
        <div
          style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {employeeData.firstName} {employeeData.lastName || ''}
              </h2>
              <StatusChip status={employeeData.status === 'ACTIVE'} />
            </div>
            <div
              style={{
                display: 'flex',
                gap: '16px',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>
                Employee Code: <strong style={{ color: 'var(--text-color)', fontFamily: 'monospace' }}>{employeeData.employeeNumber}</strong>
              </span>
              <span>
                Role: <strong style={{ color: 'var(--text-color)' }}>{getRoleLabel({ designation: employeeData.designation, user: { role: employeeData.role } })}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                TOTAL ASSIGNMENTS
              </span>
              <strong style={{ fontSize: '1.1rem' }}>{assignments.length}</strong>
            </div>

            <div
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--success)', display: 'block' }}>
                ACTIVE
              </span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--success)' }}>
                {activeAssignmentsCount}
              </strong>
            </div>

            {inactiveAssignmentsCount > 0 && (
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '0.72rem', color: 'var(--danger)', display: 'block' }}>
                  INACTIVE
                </span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--danger)' }}>
                  {inactiveAssignmentsCount}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INNER ASSIGNMENTS TABLE */}
      <DataTable
        columns={columns}
        data={assignments}
        isLoading={isLoading}
        emptyMessage="No assignments found for this employee."
      />

      {/* EDIT ASSIGNMENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsRouteDropdownOpen(false);
        }}
        title="Edit Guard Duty Assignment"
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
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

          {assignmentType === 'ROUTE' ? (
            <div>
              <label className="form-label">Select Patrol Route</label>
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
                    {selectedRouteIds.length > 0
                      ? availableRoutesForSite.find((r) => r.id === selectedRouteIds[0])?.name || '1 route selected'
                      : '-- Select Patrol Route --'}
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
                        maxHeight: '200px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '6px',
                        background: 'var(--bg-secondary, #1e293b)',
                        boxShadow: '0 12px 24px -4px rgba(0, 0, 0, 0.5)',
                      }}
                    >
                      {availableRoutesForSite.map((route) => {
                        const isChecked = selectedRouteIds.includes(route.id);
                        return (
                          <div
                            key={route.id}
                            onClick={() => {
                              setSelectedRouteIds([route.id]);
                              setIsRouteDropdownOpen(false);
                            }}
                            style={{
                              padding: '8px 10px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              borderRadius: '4px',
                              background: isChecked
                                ? 'rgba(59, 130, 246, 0.15)'
                                : 'transparent',
                              color: 'var(--text-primary)',
                            }}
                          >
                            🗺️ {route.name}
                          </div>
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
            disabled={updateAssignmentMutation.isPending}
          >
            {updateAssignmentMutation.isPending
              ? 'Saving assignment...'
              : 'Save Assignment'}
          </button>
        </form>
      </Modal>

      {/* CONFIRM STATUS TOGGLE */}
      <ConfirmationDialog
        isOpen={confirmStatus.isOpen}
        onClose={() => setConfirmStatus((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmStatusChange}
        title={
          confirmStatus.targetStatus
            ? 'Activate Assignment'
            : 'Deactivate Assignment'
        }
        description={`Are you sure you want to ${
          confirmStatus.targetStatus ? 'activate' : 'deactivate'
        } this specific assignment?`}
        confirmText={confirmStatus.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!confirmStatus.targetStatus}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}
