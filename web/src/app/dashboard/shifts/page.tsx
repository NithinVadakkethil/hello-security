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
import { FormInput } from '../../components/ui/FormControls';

interface Shift {
  id: string;
  shiftCode: string;
  name: string;
  startTime: string;
  endTime: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

const shiftSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Must be in HH:MM format'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Must be in HH:MM format'),
  description: z.string().optional(),
}).refine((data) => data.startTime !== data.endTime, {
  message: 'Start time and end time cannot be the same',
  path: ['endTime'],
});

type ShiftValues = z.infer<typeof shiftSchema>;

export default function ShiftsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Dialog / Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const [confirmStatus, setConfirmStatus] = useState<{
    isOpen: boolean;
    shiftId: string;
    shiftName: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    shiftId: '',
    shiftName: '',
    targetStatus: false,
  });

  // Fetch Shifts
  const { data: shiftsRes, isLoading } = useQuery<ApiResponse<Shift[]>>({
    queryKey: ['shifts'],
    queryFn: () => apiClient.get('/shifts'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ShiftValues>({
    resolver: zodResolver(shiftSchema),
  });

  // Create Shift mutation
  const createShiftMutation = useMutation({
    mutationFn: (values: ShiftValues) => apiClient.post('/shifts', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift slot created successfully!');
      setIsModalOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create shift.');
    },
  });

  // Update Shift mutation
  const updateShiftMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ShiftValues }) =>
      apiClient.patch(`/shifts/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift settings saved.');
      setIsModalOpen(false);
      setEditingShift(null);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update shift.');
    },
  });

  // Toggle Shift Status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/shifts/${id}/${isActive ? 'activate' : 'deactivate'}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success(`Shift successfully ${vars.isActive ? 'activated' : 'deactivated'}.`);
      setConfirmStatus((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update shift status.');
      setConfirmStatus((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const handleOpenAdd = () => {
    setEditingShift(null);
    reset({
      name: '',
      startTime: '',
      endTime: '',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (shift: Shift) => {
    setEditingShift(shift);
    reset({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      description: shift.description || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = (values: ShiftValues) => {
    if (editingShift) {
      updateShiftMutation.mutate({ id: editingShift.id, values });
    } else {
      createShiftMutation.mutate(values);
    }
  };

  const handleConfirmStatusChange = () => {
    toggleStatusMutation.mutate({
      id: confirmStatus.shiftId,
      isActive: confirmStatus.targetStatus,
    });
  };

  // Local filtering & pagination
  let shifts = shiftsRes?.data || [];

  if (search) {
    const s = search.toLowerCase();
    shifts = shifts.filter(
      (c) => c.name.toLowerCase().includes(s) || c.shiftCode.toLowerCase().includes(s)
    );
  }

  if (statusFilter !== 'ALL') {
    const activeBool = statusFilter === 'ACTIVE';
    shifts = shifts.filter((c) => c.isActive === activeBool);
  }

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(shifts.length / limit));
  const safePage = Math.min(page, totalPages);
  const paginatedShifts = shifts.slice((safePage - 1) * limit, safePage * limit);

  const columns = [
    { key: 'shiftCode', label: 'Shift Code', sortable: true },
    { key: 'name', label: 'Shift Name', sortable: true },
    {
      key: 'timing',
      label: 'Operational Hours (HH:MM)',
      render: (row: Shift) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
          {row.startTime} - {row.endTime}
        </span>
      ),
    },
    { key: 'description', label: 'Description / Handover Rules' },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: Shift) => <StatusChip status={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Shift) => (
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
                shiftId: row.id,
                shiftName: row.name,
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
            placeholder="Search shifts by name or code..."
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
          <span>Add Shift Slot</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={paginatedShifts}
        isLoading={isLoading}
        emptyMessage="No shifts found."
      />

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />

      {/* CREATE / EDIT SHIFT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingShift ? 'Modify Shift Operational Hours' : 'Configure Shift Slot'}
      >
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormInput
            label="Shift Name"
            placeholder="e.g. Morning Patrol Shift"
            error={errors.name?.message}
            {...register('name')}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Start Time (HH:MM)"
              placeholder="e.g. 08:00"
              error={errors.startTime?.message}
              {...register('startTime')}
            />

            <FormInput
              label="End Time (HH:MM)"
              placeholder="e.g. 16:00"
              error={errors.endTime?.message}
              {...register('endTime')}
            />
          </div>

          <div>
            <label className="form-label">Shift Handover & Operations Instructions</label>
            <textarea
              className="form-input"
              style={{ minHeight: '80px', resize: 'vertical' }}
              placeholder="Post specific instructions, uniform expectations, keys handover, etc."
              {...register('description')}
            />
            {errors.description?.message && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px' }}>
                {errors.description.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={createShiftMutation.isPending || updateShiftMutation.isPending}
          >
            {createShiftMutation.isPending || updateShiftMutation.isPending
              ? 'Saving shifts...'
              : editingShift
              ? 'Save Shift'
              : 'Add Shift'}
          </button>
        </form>
      </Modal>

      {/* CONFIRM STATUS TOGGLE */}
      <ConfirmationDialog
        isOpen={confirmStatus.isOpen}
        onClose={() => setConfirmStatus((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmStatusChange}
        title={confirmStatus.targetStatus ? 'Activate Shift Slot' : 'Deactivate Shift Slot'}
        description={`Are you sure you want to ${
          confirmStatus.targetStatus ? 'activate' : 'deactivate'
        } shift "${confirmStatus.shiftName}"?`}
        confirmText={confirmStatus.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!confirmStatus.targetStatus}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}
