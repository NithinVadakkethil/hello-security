'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, CheckSquare, ToggleLeft, ToggleRight, Shield, Wrench, Sparkles, Cpu, LifeBuoy, Droplet } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import Modal from '../../../components/ui/Modal';
import { FormInput, FormTextarea } from '../../../components/ui/FormControls';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';

export interface GateSubTask {
  id: string;
  gateId: string;
  role: string;
  taskName: string;
  description?: string | null;
  displayOrder: number;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
}

interface GateSubTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  gateId: string;
  gateName: string;
}

const ROLE_OPTIONS = [
  { key: 'SECURITY', label: 'Security', icon: Shield, color: '#3b82f6' },
  { key: 'CLEANER', label: 'House Keeping', icon: Sparkles, color: '#10b981' },
  { key: 'TECHNICIAN', label: 'Technician', icon: Wrench, color: '#f59e0b' },
  { key: 'SERVICE_ENGINEER', label: 'Service Engineer', icon: Cpu, color: '#8b5cf6' },
  { key: 'LIFE_GUARD', label: 'Life Guard', icon: LifeBuoy, color: '#ec4899' },
  { key: 'PLUMBER', label: 'Plumber', icon: Droplet, color: '#06b6d4' },
];

const subTaskSchema = z.object({
  taskName: z
    .string()
    .min(1, 'Task name is required')
    .max(100, 'Task name cannot exceed 100 characters'),
  description: z.string().max(300, 'Description cannot exceed 300 characters').optional(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
});

type SubTaskValues = z.infer<typeof subTaskSchema>;

export default function GateSubTasksModal({
  isOpen,
  onClose,
  gateId,
  gateName,
}: GateSubTasksModalProps) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>('SECURITY');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubTask, setEditingSubTask] = useState<GateSubTask | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    taskName: string;
  }>({
    isOpen: false,
    id: '',
    taskName: '',
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SubTaskValues>({
    resolver: zodResolver(subTaskSchema),
    defaultValues: {
      isRequired: true,
      isActive: true,
    },
  });

  // Fetch Sub Tasks by Gate & Role
  const { data: subTasksRes, isLoading } = useQuery<ApiResponse<GateSubTask[]>>({
    queryKey: ['sub-tasks', gateId, selectedRole],
    queryFn: () => apiClient.get(`/gates/${gateId}/sub-tasks`, { params: { role: selectedRole } }),
    enabled: isOpen && !!gateId,
  });

  const subTasks = subTasksRes?.data || [];

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (values: SubTaskValues) =>
      apiClient.post(`/gates/${gateId}/sub-tasks`, { ...values, role: selectedRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-tasks', gateId, selectedRole] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast.success(`Sub-task created for ${selectedRole}`);
      handleCloseForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create sub-task');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<SubTaskValues> }) =>
      apiClient.patch(`/gates/${gateId}/sub-tasks/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-tasks', gateId, selectedRole] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast.success('Sub-task updated successfully');
      handleCloseForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update sub-task');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/gates/${gateId}/sub-tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-tasks', gateId, selectedRole] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast.success('Sub-task deleted successfully');
      setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete sub-task');
      setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
    },
  });

  // Reorder Mutation
  const reorderMutation = useMutation({
    mutationFn: (items: Array<{ id: string; displayOrder: number }>) =>
      apiClient.patch(`/gates/${gateId}/sub-tasks/reorder`, { subTasks: items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-tasks', gateId, selectedRole] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast.success('Sub-tasks reordered');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reorder sub-tasks');
    },
  });

  const handleOpenAddForm = () => {
    setEditingSubTask(null);
    reset({
      taskName: '',
      description: '',
      isRequired: true,
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (task: GateSubTask) => {
    setEditingSubTask(task);
    setValue('taskName', task.taskName);
    setValue('description', task.description || '');
    setValue('isRequired', task.isRequired);
    setValue('isActive', task.isActive);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingSubTask(null);
    reset();
  };

  const onSubmit = (values: SubTaskValues) => {
    if (editingSubTask) {
      updateMutation.mutate({ id: editingSubTask.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleMove = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subTasks.length) return;

    const newTasks = [...subTasks];
    const temp = newTasks[index];
    newTasks[index] = newTasks[targetIndex];
    newTasks[targetIndex] = temp;

    const reorderedItems = newTasks.map((t, idx) => ({
      id: t.id,
      displayOrder: idx,
    }));

    reorderMutation.mutate(reorderedItems);
  };

  const handleToggleActive = (task: GateSubTask) => {
    updateMutation.mutate({
      id: task.id,
      values: { isActive: !task.isActive },
    });
  };

  const activeRoleObj = ROLE_OPTIONS.find((r) => r.key === selectedRole) || ROLE_OPTIONS[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Checkpoint Verification Sub-Tasks: ${gateName}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '340px', maxWidth: '720px' }}>
        
        {/* Role Switcher Tabs */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Select Operational Role Tasks:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {ROLE_OPTIONS.map((r) => {
              const IconComp = r.icon;
              const isSelected = selectedRole === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    setSelectedRole(r.key);
                    setIsFormOpen(false);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: isSelected ? `2px solid ${r.color}` : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? `${r.color}22` : 'var(--surface-color)',
                    color: isSelected ? r.color : 'var(--text-color)',
                  }}
                >
                  <IconComp size={15} color={r.color} />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-color)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <activeRoleObj.icon size={18} color={activeRoleObj.color} />
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: activeRoleObj.color }}>
                {activeRoleObj.label} Tasks ({subTasks.length})
              </span>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                These tasks appear exclusively for employees logged in with role <b>{activeRoleObj.label}</b>.
              </p>
            </div>
          </div>
          {!isFormOpen && (
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Add {activeRoleObj.label} Task</span>
            </button>
          )}
        </div>

        {/* Add / Edit Sub Task Form Drawer */}
        {isFormOpen && (
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: `1px solid ${activeRoleObj.color}66`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: activeRoleObj.color }}>
              {editingSubTask ? `Edit ${activeRoleObj.label} Task` : `Add New ${activeRoleObj.label} Task`}
            </h4>
            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <FormInput
                label="Task Question / Title *"
                placeholder={`e.g. ${activeRoleObj.label} inspection question`}
                error={errors.taskName?.message}
                {...register('taskName')}
              />
              <FormTextarea
                label="Instructions / Operational Notes (Optional)"
                placeholder="e.g. Check equipment status and report remarks"
                error={errors.description?.message}
                {...register('description')}
              />
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" {...register('isRequired')} style={{ width: '16px', height: '16px', accentColor: activeRoleObj.color }} />
                  <span style={{ fontWeight: 600 }}>Required Answer (Cannot be skipped)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" {...register('isActive')} style={{ width: '16px', height: '16px', accentColor: activeRoleObj.color }} />
                  <span style={{ fontWeight: 600 }}>Active Status</span>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={handleCloseForm} className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '6px 16px', backgroundColor: activeRoleObj.color, borderColor: activeRoleObj.color }}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingSubTask
                    ? 'Update Task'
                    : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sub Tasks List */}
        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading {activeRoleObj.label} tasks...
          </div>
        ) : subTasks.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              borderRadius: '12px',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--surface-color)',
            }}
          >
            <CheckSquare size={36} style={{ marginBottom: '8px', opacity: 0.5, color: activeRoleObj.color }} />
            <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: 'var(--text-color)' }}>
              No verification tasks configured for {activeRoleObj.label}
            </p>
            <p style={{ margin: 0, fontSize: '0.82rem' }}>
              Click <b>&quot;Add {activeRoleObj.label} Task&quot;</b> above to create role-specific verification questions.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
            {subTasks.map((task, idx) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  opacity: task.isActive ? 1 : 0.55,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'UP')}
                      style={{ border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 0.8, color: 'var(--text-color)' }}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === subTasks.length - 1}
                      onClick={() => handleMove(idx, 'DOWN')}
                      style={{ border: 'none', background: 'none', cursor: idx === subTasks.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === subTasks.length - 1 ? 0.3 : 0.8, color: 'var(--text-color)' }}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)' }}>
                        {idx + 1}. {task.taskName}
                      </span>
                      {task.isRequired ? (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600 }}>
                          Required
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--chip-bg, #333)', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Optional
                        </span>
                      )}
                      {!task.isActive && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#475569', color: '#cbd5e1', fontWeight: 600 }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(task)}
                    title={task.isActive ? 'Deactivate Task' : 'Activate Task'}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: task.isActive ? '#10b981' : '#64748b' }}
                  >
                    {task.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditForm(task)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                    title="Edit Task"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ isOpen: true, id: task.id, taskName: task.taskName })}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                    title="Delete Task"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => deleteMutation.mutate(deleteConfirm.id)}
        title="Delete Verification Sub Task"
        description={`Are you sure you want to delete "${deleteConfirm.taskName}"? This action cannot be undone.`}
        confirmText="Delete Task"
        isDanger
        isLoading={deleteMutation.isPending}
      />
    </Modal>
  );
}
